import { TaiwanIndependenceDatabase } from "../db/taiwan-independence";
import { Draw } from "@mai-kit/draw";

export async function generateB50Poster(profile: any, bests: any): Promise<Buffer> {
    const draw = new Draw({
      database: new TaiwanIndependenceDatabase() as any,
    });
    const result = await draw.poster(profile, bests);
    return Buffer.from(result);
}
