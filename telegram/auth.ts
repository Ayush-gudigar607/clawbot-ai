import { env } from "../src/config/env";

export const isOwner = (id: number) => String(id) === env.TELEGRAM_OWNER_ID;