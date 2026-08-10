import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { RegistryProvider } from "./data";
import { WalletProvider } from "./context/WalletContext";
import { MyRecord } from "./pages/MyRecord";
import { Home } from "./pages/Home";
import { Search } from "./pages/Search";
import { OrgDetail } from "./pages/OrgDetail";
import { PersonDetail } from "./pages/PersonDetail";
import { ClaimDetail } from "./pages/ClaimDetail";
import { HandleRoute } from "./pages/HandleRoute";
import { Apply } from "./pages/Apply";
import { Verify } from "./pages/Verify";
import { LiveBadge } from "./pages/LiveBadge";
import { Standard } from "./pages/Standard";
import { Manage } from "./pages/Manage";
import { NotFound } from "./pages/NotFound";

function App() {
  return (
    <Routes>
      {/* Intentionally outside Layout: this route is embedded on third-party
          sites and must stay compact, while still reading the same registry. */}
      <Route
        path="badge/:handle"
        element={
          <RegistryProvider>
            <LiveBadge />
          </RegistryProvider>
        }
      />
      <Route element={<StaticLayout />}>
        {/* These operational/static routes remain available during an RPC outage. */}
        <Route path="apply" element={<Apply />} />
        <Route path="standard" element={<Standard />} />
        <Route path="*" element={<NotFound />} />
      </Route>

      {/* Provider wraps Layout—not only its Outlet—so shared navbar search and
          controller lookup receive the same registry snapshot as the page. */}
      <Route element={<RegistryLayout />}>
        <Route index element={<Home />} />
        <Route path="me" element={<MyRecord />} />
        <Route path="verify" element={<Verify />} />
        <Route path="manage" element={<Manage />} />
        <Route path="search" element={<Search />} />
        <Route path="org/:id" element={<OrgDetail />} />
        <Route path="person/:id" element={<PersonDetail />} />
        <Route path="tx/:id" element={<ClaimDetail />} />
        {/* React Router ranks these below the concrete static paths above. */}
        <Route path=":handle" element={<HandleRoute />} />
      </Route>
    </Routes>
  );
}

function RegistryLayout() {
  return (
    <WalletProvider>
      <RegistryProvider>
        <Layout />
      </RegistryProvider>
    </WalletProvider>
  );
}

function StaticLayout() {
  return (
    <WalletProvider>
      <Layout />
    </WalletProvider>
  );
}

export default App;
