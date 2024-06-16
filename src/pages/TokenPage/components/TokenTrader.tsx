import React, { useState } from "react";
import { twMerge } from "tailwind-merge";
import Icon from "../../../common/Icon";
import { Token } from "../../../types";
import {
  useAccount,
  useContractEvent,
  useContractRead,
  useContractWrite,
  useWaitForTransaction,
} from "wagmi";
import contractDefinitions from "../../../contracts";
import { ONE_FRAX, ONE_TOKEN } from "../../../config";

interface TokenTraderProps {
  token: Token;
}

type TradingPairEntry = {
  name: string;
  image: string;
  balance: bigint | undefined;
};

export default function TokenTrader(props: TokenTraderProps) {
  const { token } = props;
  const { address } = useAccount();

  const [loading, setLoading] = useState(false);

  if (!address) return <></>;

  const fraxBalance = useContractRead({
    ...contractDefinitions.frax,
    functionName: "balanceOf",
    args: [address],
  });

  const tokenBalance = useContractRead({
    ...contractDefinitions.token,
    address: token.address,
    functionName: "balanceOf",
    args: [address],
  });

  const fraxAllowance = useContractRead({
    ...contractDefinitions.frax,
    functionName: "allowance",
    args: [address, token.address],
  });

  const tokenAllowance = useContractRead({
    ...contractDefinitions.token,
    address: token.address,
    functionName: "allowance",
    args: [address, token.address],
  });

  const tradingPair = [
    { name: "FRAX", image: "/icons/frax.png", balance: fraxBalance.data },
    { name: token.symbol, image: token.image, balance: tokenBalance.data },
  ];

  const [tradeState, setTradeState] = useState<"BUY" | "SELL">("BUY");

  const buying = tradeState == "BUY" ? 1 : 0;
  const selling = tradeState == "SELL" ? 1 : 0;

  const reserve = useContractRead({
    ...contractDefinitions.token,
    address: token.address,
    functionName: "reserve",
  });
  const supply = useContractRead({
    ...contractDefinitions.token,
    address: token.address,
    functionName: "supply",
  });

  useContractEvent({
    ...contractDefinitions.token,
    address: token.address,
    eventName: "PriceChange",
    listener: () => {
      reserve.refetch();
      supply.refetch();
    },
  });

  const [amount, setAmount] = useState({ buy: 0n, sell: 0n });
  const [slippage, setSlippage] = useState(0.01);

  function setSellAmount(amt: number) {
    if (!supply.data || !reserve.data) return;

    if (tradeState == "BUY") {
      const amount = BigInt(amt) * ONE_FRAX;
      setAmount({
        sell: amount,
        buy: (supply.data * amount) / (reserve.data + amount),
      });
    }

    if (tradeState == "SELL") {
      const amount = BigInt(amt) * ONE_TOKEN;
      setAmount({
        sell: amount,
        buy: (reserve.data * amount) / (supply.data + amount),
      });
    }
  }

  const approveFrax = useContractWrite({
    ...contractDefinitions.frax,
    functionName: "approve",
  });

  const approveToken = useContractWrite({
    ...contractDefinitions.token,
    address: token.address,
    functionName: "approve",
  });

  const buyF = useContractWrite({
    ...contractDefinitions.token,
    address: token.address,
    functionName: "buy",
    args: [amount.buy],
  });

  const sellF = useContractWrite({
    ...contractDefinitions.token,
    address: token.address,
    functionName: "sell",
    args: [amount.sell],
  });

  useWaitForTransaction({
    hash: approveFrax.data?.hash,
    onSuccess: async () => {
      buyF.write();
    },
  });

  useWaitForTransaction({
    hash: approveToken.data?.hash,
    onSuccess: async () => {
      sellF.write();
    },
  });

  useWaitForTransaction({
    hash: sellF.data?.hash || buyF.data?.hash,
    onSuccess: () => {
      console.log(fraxAllowance.data);
      setLoading(false);
      fraxBalance.refetch();
      tokenBalance.refetch();
      fraxAllowance.refetch();
      tokenAllowance.refetch();
    },
  });

  const hasInsufficientFunds =
    (tradeState === "BUY" && (fraxBalance.data || 0n) < amount.sell) ||
    (tradeState === "SELL" && (tokenBalance.data || 0n) < amount.sell);

  return (
    <div
      className={twMerge(
        "w-1/4 flex flex-col items-center relative gap-y-2 h-max",
        (reserve.isLoading || supply.isLoading) &&
          "opacity-75 animate-pulse pointer-events-none cursor-progress",
        loading && "animate-pulse"
      )}
    >
      <p className="self-start animate-pulse">
        You are {tradeState.toLowerCase()}ing {token.symbol} for {"FRAX"}
      </p>

      <div className="flex gap-x-1">
        <input
          placeholder={`current slippage ${slippage * 100}%`}
          className="text-sm px-2 py-1 bg-transparent border border-front/20 rounded-md focus-within:outline-none"
        />
        <button className="text-sm self-end py-1 px-3 rounded-md bg-front/10 whitespace-nowrap">
          Set max slippage
        </button>
      </div>

      <div className="border border-front/20 p-3 rounded-lg min-h-[15vh]">
        <h1>Sell</h1>
        <TradingPairMember
          token={tradingPair[selling]}
          max={Number(tradingPair[selling].balance) / Number(ONE_FRAX)}
          setSellAmount={setSellAmount}
          label="Max"
        />
      </div>

      <button
        className="p-1 scale-150 border w-max border-front/20 text-xs bg-background rounded-md rotate-90 absolute left-1/2 -translate-x-1/2 top-1/2 "
        onClick={() => {
          setTradeState((p) => (p === "BUY" ? "SELL" : "BUY"));
          setSellAmount(0);
        }}
      >
        <Icon icon="arrow_forward" />
      </button>

      <div className="border border-front/20 p-3 rounded-lg min-h-[15vh]">
        <h1>Buy</h1>
        <TradingPairMember
          token={tradingPair[buying]}
          buyAmount={Number(amount.buy) / Number(ONE_TOKEN)}
          label="Balance"
        />
      </div>

      <button
        className={twMerge(
          "w-full rounded-md py-2 text-black font-semibold disabled:opacity-50",
          tradeState == "BUY" ? "bg-green-400" : "bg-red-400"
        )}
        disabled={hasInsufficientFunds || loading}
        onClick={() => {
          setLoading(true);
          if (tradeState == "BUY") {
            const requiredAllowance = amount.sell;
            {
              fraxAllowance.data &&
                console.log(
                  fraxAllowance.data / ONE_FRAX,
                  requiredAllowance / ONE_FRAX,
                  fraxAllowance.data || 0 < requiredAllowance
                );
            }
            if ((fraxAllowance.data || 0n) < requiredAllowance) {
              const nextAllowance =
                BigInt(10) ** BigInt(requiredAllowance.toString().length);
              approveFrax.write({
                args: [token.address, nextAllowance],
              });
            } else {
              buyF.write();
            }
          }

          if (tradeState == "SELL") {
            if ((tokenAllowance.data || 0n) < amount.buy) {
              approveToken.write({
                args: [token.address, BigInt(token.totalSupply) * ONE_TOKEN],
              });
            } else {
              sellF.write();
            }
          }
        }}
      >
        {tradeState}
      </button>
      {hasInsufficientFunds && (
        <p className="text-red-500 text-sm self-end">* Insufficient funds</p>
      )}
    </div>
  );
}

interface TradingPairMemberProps {
  token: TradingPairEntry;
  setSellAmount?: (amt: number) => void;
  buyAmount?: number;
  max?: number;
  label: string;
}

function TradingPairMember(props: TradingPairMemberProps) {
  const { token, setSellAmount, label } = props;

  return (
    <>
      <div className="flex gap-x-2 justify-between">
        <input
          className="bg-transparent text-xl py-2 w-2/3 focus-within:outline-none"
          placeholder="0"
          disabled={!setSellAmount}
          value={props.buyAmount}
          min={0}
          onChange={(e) => {
            const amt = Number(e.target.value);
            if (props.max && amt > props.max) {
              e.target.value = props.max.toString();
            }
            setSellAmount && setSellAmount(Number(e.target.value));
          }}
          type="number"
        />
        <div className="flex gap-x-2 items-center bg-front/10 w-max rounded-2xl h-max py-1 px-2 justify-end">
          <h1>{token.name}</h1>
          <img
            src={token.image}
            alt={token.name}
            className="w-[1.5vw] aspect-square object-cover rounded-full"
          />{" "}
        </div>
      </div>
      <p className="text-sm flex justify-end pt-1 text-front/70">
        {props.label}:{" "}
        {(Number(token.balance || 0n) / Number(ONE_FRAX)).toString()}{" "}
        {token.name}
      </p>
    </>
  );
}
