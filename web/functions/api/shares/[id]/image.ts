import { getScreenshot, type Env } from "../../../../server/share-api";

export const onRequestGet: PagesFunction<Env> = ({ request, env, params }) => {
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  return getScreenshot(request, env, id || "");
};
