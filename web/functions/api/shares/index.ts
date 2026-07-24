import { createShare, preflightForRequest, type Env } from "../../../server/share-api";

export const onRequestPost: PagesFunction<Env> = ({ request, env }) => createShare(request, env);
export const onRequestOptions: PagesFunction<Env> = ({ request, env }) => preflightForRequest(request, env);
