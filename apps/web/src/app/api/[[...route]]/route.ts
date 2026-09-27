// Hono のマウント先。apps/web で唯一許可された Route Handler(ADR-0010)。

import { handle } from 'hono/vercel';

import { getApi } from '../../../server/container';

const handler = handle(getApi().app);

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
