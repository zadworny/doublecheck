import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Home } from "./pages/Home";
import { Search } from "./pages/Search";
import { OrgDetail } from "./pages/OrgDetail";
import { PersonDetail } from "./pages/PersonDetail";
import { ClaimDetail } from "./pages/ClaimDetail";
import { NotFound } from "./pages/NotFound";

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="search" element={<Search />} />
        <Route path="org/:id" element={<OrgDetail />} />
        <Route path="person/:id" element={<PersonDetail />} />
        <Route path="tx/:id" element={<ClaimDetail />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

export default App;
