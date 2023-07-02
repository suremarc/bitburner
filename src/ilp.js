/** @param {NS} ns **/
export async function main(ns) {
    let target = ns.getHostname();

    let ram = ns.getServerMaxRam(target);

    const hackTime = ns.getHackTime(target);
    const growTime = ns.getGrowTime(target);
    const weakenTime = ns.getWeakenTime(target);

    const hackCount = Math.floor(weakenTime / hackTime);
    const growCount = Math.floor(weakenTime / growTime);

    const growthPercent = Math.pow(2, 1 / ns.growthAnalyze(target, 2)) - 1;

    const hackMoney = ns.hackAnalyze(target);
    const growthMoney = ns.getServerMoneyAvailable(target) * growthPercent;
    ns.tprintf("money per growth: %f", growthMoney);

    let constraintSecurity = (h, g, w) => {
        return 0.002 * h * hackCount / hackTime + 0.004 * g * growCount / growTime - 0.05 * w / weakenTime < 0;
    }

    let constraintMoney = (h, g, w) => {
        return h * hackCount * hackMoney / hackTime - g * growCount * growthMoney / growTime < 0
    }

    let constraintRam = (h, g, w) => {
        return h * ns.getScriptRam("h.js") + g * ns.getScriptRam("g.js") + w * ns.getScriptRam("w.js") < ram;
    }

    let maximizer = (h, g, w) => {
        return h * hackCount * hackMoney / hackTime - g * growCount * growthMoney / growTime;
    }

    let [hBest, gBest, wBest] = [1, 1, 1];

    let maxThreads = ns.getServerMaxRam(target) / 2;
    for (let h = 1; h < maxThreads; h++) {
        for (let g = 1; g < maxThreads; g++) {
            for (let w = 1; w < maxThreads; w++) {
                if (constraintSecurity(h, g, w) && constraintMoney(h, g, w) && constraintRam(h, g, w)) {
                    if (maximizer(h, g, w) > maximizer(hBest, gBest, wBest)) {
                        [hBest, gBest, wBest] = [h, g, w]
                    }
                }
            }
        }
    }

    if (!(constraintSecurity(hBest, gBest, wBest) && constraintMoney(hBest, gBest, wBest) && constraintRam(hBest, gBest, wBest))) {
        throw "Couldn't satisfy constraints";
    }

    ns.tprintf("Best threads: h = %d, g = %d, w = %d", hBest, gBest, wBest);
}