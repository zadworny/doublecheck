import { useParams } from "react-router-dom";
import { useRegistry } from "../data";
import { OrgDetail } from "./OrgDetail";
import { PersonDetail } from "./PersonDetail";
import { NotFound } from "./NotFound";

/**
 * Resolves `/<handle>` — the canonical shape of a shared verification link.
 *
 * Handles are what people put in an email signature and read out on a call, so
 * the shared URL uses one rather than a numeric entity id. It also survives a
 * redeployment to a new contract, where ids would not.
 *
 * Registered as the last route, so every static path and every `/org`, `/person`
 * or `/tx` prefix is matched first.
 */
export function HandleRoute() {
  const { handle = "" } = useParams();
  const { getByHandle } = useRegistry();

  const subject = getByHandle(handle);
  if (!subject) return <NotFound />;

  return subject.kind === "organisation" ? (
    <OrgDetail orgId={subject.id} />
  ) : (
    <PersonDetail personId={subject.id} />
  );
}
