/**
 * @param {NS} ns
 * @param {string} hostname
 * @param {number} availableRam
 */
async function pickTarget(ns, hostname, availableRam) {
    let bestTarget = hostname;
    let bestRate = 0;

    let viableTargets = ns.scan(hostname).concat([hostname]).filter((name) => ns.getServerRequiredHackingLevel(name) <= ns.getHackingLevel())
        .filter((name) => ns.hasRootAccess(name));
    // ns.tprintf("%s: %v", hostname, viableTargets);
    for (const target of viableTargets) {
        let [h, hd, g, w] = [0, 0, 0, 0]
        try {
            [h, hd, g, w] = await ilp(ns, target, availableRam);
        } catch (err) {
            // ns.tprintf("%v", err);
            continue;
        }

        const hackTime = ns.getHackTime(target) + hd;
        const weakenTime = ns.getWeakenTime(target);
        const hackCount = weakenTime / hackTime;

        const hackChance = ns.hackAnalyzeChance(target);
        const hackPercent = ns.hackAnalyze(target);

        const growTime = ns.getGrowTime(target);

        const growCount = weakenTime / growTime;
        const growthPercent = Math.pow(2, 1 / ns.growthAnalyze(target, 2)) - 1;

        const serverMoney = (target == "home") ? 0 : ns.getServerMoneyAvailable(target);
        const rate = (h * hackCount * hackChance * hackPercent + g * growCount * growthPercent) * serverMoney / weakenTime;

        // ns.tprintf("\t%s: %f", target, rate);

        if (rate > bestRate && h > 0) {
            bestRate = rate;
            bestTarget = target;
        }
    }

    return bestTarget;
}

/**
 * @param {NS} ns
 * @param {string} host
 * @param {string[]} alreadyTraversed
 */
async function commandeer(ns, target, alreadyTraversed = []) {
    if (alreadyTraversed.length == 0) {
        alreadyTraversed.push(target);
        try {
            let hostname = "home";
            ns.scriptKill("h.js", "home");
            ns.scriptKill("g.js", "home");
            ns.scriptKill("w.js", "home");

            let availableRam = ns.getServerMaxRam(hostname) - ns.getServerUsedRam(hostname);
            let homeTarget = await pickTarget(ns, hostname, availableRam);

            let requiredHackingLevel = ns.getServerRequiredHackingLevel(homeTarget);
            if (ns.getHackingLevel() >= requiredHackingLevel) {
                const [h, hd, g, w] = await ilp(ns, homeTarget, availableRam);
                for (let i = 0; i < h; i++) {
                    if (i % 250 == 0) {
                        await ns.sleep(25);
                    }
                    console.assert(ns.exec("h.js", hostname, 1, homeTarget, (2 + Math.random()) * ns.getWeakenTime(homeTarget), hd, i) != 0);
                }
                for (let j = 0; j < g; j++) {
                    if (j % 250 == 0) {
                        await ns.sleep(25);
                    }
                    console.assert(ns.exec("g.js", hostname, 1, homeTarget, (1 + Math.random()) * ns.getWeakenTime(homeTarget), j) != 0);
                }
                for (let k = 0; k < w; k++) {
                    if (k % 250 == 0) {
                        await ns.sleep(25);
                    }
                    console.assert(ns.exec("w.js", hostname, 1, homeTarget, Math.random() * ns.getWeakenTime(homeTarget), k) != 0);
                }
            } else {
                ns.tprintf("Can't hack %s (required level >= %d), skipping", hostname, requiredHackingLevel);
            }
        } catch (err) {
            ns.tprintf("%v", err);
        }
    }

    let hosts = ns.scan(target)
        .filter((hostname) => !alreadyTraversed.includes(hostname))
        .map(hostname => {
            return {
                hostname: hostname,
                hackingLevel: ns.getServerRequiredHackingLevel(hostname),
                openPorts: ns.getServerNumPortsRequired(hostname),
            }
        })
        .sort((x, y) => { return x.hackingLevel < y.hackingLevel })
        .map(({ hostname: hostname }) => hostname);

    alreadyTraversed = alreadyTraversed.filter(s => !hosts.includes(s)).concat(hosts);

    for (const hostname of hosts) {
        try {
            try {
                ns.brutessh(hostname);
                ns.ftpcrack(hostname);
                ns.relaysmtp(hostname);
                ns.httpworm(hostname);
                ns.sqlinject(hostname);
            } catch (err) {
                // ns.tprintf("Couldn't open ports: %s", err);
            }
            ns.nuke(hostname);
            console.assert(await ns.scp([
                "h.js",
                "g.js",
                "w.js",
            ], hostname));
            ns.killall(hostname);
            await commandeer(ns, hostname, alreadyTraversed);

            let availableRam = ns.getServerMaxRam(hostname);
            let target = await pickTarget(ns, hostname, availableRam);

            let requiredHackingLevel = ns.getServerRequiredHackingLevel(target);
            if (ns.getHackingLevel() >= requiredHackingLevel) {
                const [h, hd, g, w] = await ilp(ns, hostname, availableRam);
                for (let i = 0; i < h; i++) {
                    if (i % 250 == 0) {
                        await ns.sleep(25);
                    }
                    console.assert(ns.exec("h.js", hostname, 1, target, (2 + Math.random()) * ns.getWeakenTime(target), hd, i) != 0);
                }
                for (let j = 0; j < g; j++) {
                    if (j % 250 == 0) {
                        await ns.sleep(25);
                    }
                    console.assert(ns.exec("g.js", hostname, 1, target, (1 + Math.random()) * ns.getWeakenTime(target), j) != 0);
                }
                for (let k = 0; k < w; k++) {
                    if (k % 250 == 0) {
                        await ns.sleep(25);
                    }
                    console.assert(ns.exec("w.js", hostname, 1, target, Math.random() * ns.getWeakenTime(target), k) != 0);
                }
            } else {
                ns.tprintf("Can't hack %s (required level >= %d), skipping", hostname, requiredHackingLevel);
            }
        } catch (err) {
            ns.tprintf("Can't hack %s (required ports >= %d), skipping", hostname, ns.getServerNumPortsRequired(hostname));
            ns.tprintf("%s", err);
            ns.killall(hostname);
        }
    }
}

/** @param {NS} ns **/
export async function main(ns) {
    await commandeer(ns, ns.getHostname());
}

/**
 * @param {NS} ns
 * @param {number} ram
 */
async function ilp(ns, target, ram) {
    const growTime = ns.getGrowTime(target);
    const weakenTime = ns.getWeakenTime(target);

    const growCount = weakenTime / growTime;

    const hackChance = ns.hackAnalyzeChance(target);

    const hackPercent = ns.hackAnalyze(target);
    const growthPercent = Math.pow(2, 1 / ns.growthAnalyze(target, 2)) - 1;

    // const hackMoney = ns.getServerMoneyAvailable(target) * ns.hackAnalyze(target);
    // const growthMoney = ns.getServerMoneyAvailable(target) * growthPercent;

    // ns.tprintf("Hack money: %f, grow money: %f", hackMoney, growthMoney);
    let constraintSecurity = (h, hd, g, w) => {
        const hackTime = ns.getHackTime(target) + hd;
        const hackCount = weakenTime / hackTime;
        return 0.002 * h * hackCount * hackChance + 0.004 * g * growCount - 0.05 * w <= 0;
    }

    const maxDrainRate = 0 / 3_600_000;
    let constraintDrain = (h, hd, g, w) => {
        const hackTime = ns.getHackTime(target) + hd;
        const hackCount = weakenTime / hackTime;
        return (h * hackCount * hackChance * hackPercent - g * growCount * growthPercent) / weakenTime <= maxDrainRate;
    }

    let constraintRam = (h, hd, g, w) => {
        return h * ns.getScriptRam("h.js") + g * ns.getScriptRam("g.js") + w * ns.getScriptRam("w.js") <= ram;
    }

    let maximizer = (h, hd, g, w) => {
        const hackTime = ns.getHackTime(target) + hd;
        const hackCount = weakenTime / hackTime;
        return (h * hackCount * hackChance * hackPercent + g * growCount * growthPercent) / weakenTime;
    }

    let [hBest, hBestDelay, gBest, wBest] = [0, 0, 1, 1];
    let bestParams = [];
    let bestProfit = -1_000_000;

    for (let hDelay = 1000; hDelay <= 1024_000; hDelay *= 4) {
        // await ns.sleep(100);
        // ns.tprintf("trying delay: %d", hDelay);
        const hackTime = ns.getHackTime(target) + hDelay;
        const hackCount = weakenTime / hackTime;

        let [objective, constraints, bounds] = [
            [hackCount * hackChance * hackPercent, growCount * growthPercent, 0],
            [
                [0.002 * hackCount * hackChance, 0.004 * growCount, -0.05 / 2],
                [1.5 * hackCount * hackChance * hackPercent / weakenTime, -growCount * growthPercent / weakenTime, 0],
                [ns.getScriptRam("h.js"), ns.getScriptRam("g.js"), ns.getScriptRam("w.js")],
            ],
            [0, 0 / 3_600_000, ram - 4],
        ];
        // ns.tprintf("params: %v\n%v\n%v\n", objective, constraints, bounds);
        // await ns.sleep(25);
        let [h, g, w] = simplex(objective, constraints, bounds);
        // ns.tprintf("got %f, %f, %f", h, g, w);

        let result = objective[0] * Math.floor(h) + objective[1] * Math.ceil(g) + objective[2] * Math.ceil(w);
        if (result > bestProfit) {
            [hBest, hBestDelay, gBest, wBest, bestParams, bestProfit] = [Math.floor(h), hDelay, Math.ceil(g), Math.ceil(w), [objective, constraints, bounds], result];
            // ns.tprintf("%f, %d, %f, %f", hBest, hBestDelay, gBest, wBest);
        }
    }

    ns.tprint(target);
    // ns.tprintf("%v\n%v\n%v\n", ...bestParams);
    ns.tprintf("%d, %d, %d, %d", hBest, hBestDelay, gBest, wBest);

    // if (!(constraintSecurity(hBest, hBestDelay, gBest, wBest) && constraintDrain(hBest, hBestDelay, gBest, wBest) && constraintRam(hBest, hBestDelay, gBest, wBest))) {
    // // if (!(constraintRam(hBest, hBestDelay, gBest, wBest) && constraintDrain(hBest, hBestDelay, gBest, wBest))) {
    // 	throw "Couldn't satisfy constraints";
    // }

    return [hBest, hBestDelay, gBest, wBest];
}

/**
 * @param {number} start
 * @param {number} end
 */
function range(start, end) {
    const length = end - start;
    return Array.from({ length }, (_, i) => start + i);
}


/**
 *
 * @param {number[]} objective
 * @param {number[][]} constraints
 * @param {number[]} bounds
 */
function simplex(objective, constraints, bounds) {
    const eps = 0;
    const n = objective.length;
    const m = constraints.length;
    console.assert(bounds.length === m);
    for (const row of constraints) {
        console.assert(row.length === n);
    }

    let tableau = [[1].concat(...objective.map((x) => -x)).concat(range(0, m + 1).map((_) => 0))]
        .concat(
            constraints.map((row, index) => {
                return [0]
                    .concat(...row)
                    .concat(range(0, m).map((x) => (x === index ? 1 : 0)))
                    .concat(bounds[index]);
            }),
        );

    const normalize = (row, varIndex) => {
        const val = row[varIndex];
        for (let i = 0; i < row.length; i++) {
            row[i] /= val;
        }
    };

    // self - other * multiplier
    const subtract = (self, other, multiplier) => {
        for (let i = 0; i < self.length; i++) {
            self[i] -= other[i] * multiplier;
        }
    };

    const basic = range(n + 1, n + m + 1);

    while (true) {
        // find a pivot that increases the objective function
        // pivot on row i, column j:
        // leaving variable is basic[i]
        // entering variable is j
        //
        // first collect possible pivots

        // console.log(basic);
        // readlineSync.question(tableau.forEach((row) => console.log(row)));

        const candidatePivots = range(1, m + 1).flatMap((i) => {
            return range(1, n + m + 1)
                .filter((j) => !basic.includes(j) && tableau[0][j] < -eps)
                .filter((j) => tableau[i][j] > eps)
                .map((j) => {
                    return {
                        row: i,
                        col: j,
                    };
                })
        });

        candidatePivots.sort((a, b) => {
            if (tableau[a.row][n + m + 1] / tableau[a.row][a.col] != tableau[b.row][n + m + 1] / tableau[b.row][b.col]) {
                return tableau[a.row][n + m + 1] / tableau[a.row][a.col] - tableau[b.row][n + m + 1] / tableau[b.row][b.col]
            }

            return basic[a.row - 1] - basic[b.row - 1];
        });

        if (candidatePivots.length === 0) {
            return range(1, n + 1).map((v, index) => {
                return basic.includes(v) ? tableau[basic.indexOf(v) + 1][n + m + 1] : 0
            });
        }

        const pivot = candidatePivots[0];
        normalize(tableau[pivot.row], pivot.col);
        for (const rowOther of range(0, m + 1)
            .filter((x) => x !== pivot.row)
            .map((x) => tableau[x])) {
            subtract(rowOther, tableau[pivot.row], rowOther[pivot.col]);
        }

        const leaving = basic[pivot.row - 1];
        // console.log(pivot, "leaving var " + leaving);
        basic[pivot.row - 1] = pivot.col;
    }
}