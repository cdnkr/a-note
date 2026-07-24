import { getShare, type Env } from "../../../../server/share-api";

export const onRequestGet: PagesFunction<Env> = ({ request, env, params }) => {
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  return getShare(request, env, id || "");
};
