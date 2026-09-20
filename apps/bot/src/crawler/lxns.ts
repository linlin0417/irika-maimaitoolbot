import { createLxnsClient } from "@mai-kit/prober";

export async function fetchPlayerData(token: string) {
    const player = createLxnsClient({
        personalAccessToken: token,
    }).me();
    
    const [profile, bests] = await Promise.all([
        player.getProfile(), 
        player.getBests()
    ]);
    
    return { profile, bests };
}
