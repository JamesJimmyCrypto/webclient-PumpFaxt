import {
  Route,
  createBrowserRouter,
  createRoutesFromElements,
} from "react-router-dom";
import Layout from "../layout";

import HomePage from "./HomePage/HomePage";
import ErrorPage from "./ErrorPage/ErrorPage";
import ShowcasePage from "./ShowcasePage";
import DashboardPage from "./DashboardPage";
import ProtectedRoute, { ProtectedTypes } from "../common/ProtectedRoute";
import StreamingTestPage from "./StreamingTestPage/StreamingTestPage";
import HuddleVoicePage from "./HuddleVoicePage";
import TokenPage from "./TokenPage";

const router = createBrowserRouter(
  createRoutesFromElements(
    <>
      <Route element={<Layout.Default />}>
        <Route index element={<HomePage />} />
        <Route path="showcase" element={<ShowcasePage />} />

        <Route element={<ProtectedRoute type={ProtectedTypes.CONNECTEDONLY} />}>
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="/T/:address" element={<TokenPage />} />
          <Route path="/T/:id/voice" element={<HuddleVoicePage />} />
          <Route path="/testing" element={<StreamingTestPage />} />
        </Route>
      </Route>

      <Route path="*" element={<ErrorPage />} />
    </>
  )
);

export default router;
