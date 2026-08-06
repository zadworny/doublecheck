import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { RegistryProvider } from "./data";
import { Home } from "./pages/Home";
import { Search } from "./pages/Search";
import { OrgDetail } from "./pages/OrgDetail";
import { PersonDetail } from "./pages/PersonDetail";
import { ClaimDetail } from "./pages/ClaimDetail";
import { HandleRoute } from "./pages/HandleRoute";
import { NotFound } from "./pages/NotFound";

function App() {
  return (
    <Routes>
      <Route
        element={
          <RegistryProvider>
            <Layout />
          </RegistryProvider>
        }
      >
        <Route index element={<Home />} />
        <Route path="search" element={<Search />} />
        <Route path="org/:id" element={<OrgDetail />} />
        <Route path="person/:id" element={<PersonDetail />} />
        <Route path="tx/:id" element={<ClaimDetail />} />
        {/* Last: every static path and prefixed route is matched before this. */}
        <Route path=":handle" element={<HandleRoute />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

export default App;
