import { NS } from './types/NetscriptDefinitions.d';

export async function main(ns: NS) {
    const targets = recursiveScan(ns).filter(host => crack(ns, host));

    ns.tprint(["INFO: Targets with root access:"].concat(targets).join('\n\t'))

    targets.forEach(host => {
        for (const name of ['prepare.js', 'weaken.js']) {
            ns.rm(name, host);
        }

        ns.scp(['hgw.js'], host);
    });

    let states = targets.map(host => new StateContext(new StateWeaken(ns, host)));

    ns.disableLog('sleep')
    while (await ns.sleep(100)) {
        for (const state of states) {
            try {
                state.advance();
            } catch (err) {
                state.state = null;
            }
        }

        if (states.filter(state => !(state instanceof StateCompleted)).length == 0) {
            ns.tprint(`All processes are completed, tearing down`)
            break
        }
    }
}

class StateContext {
    state: State;

    constructor(state: State) {
        this.state = state;
    }

    advance() {
        this.state = this.state.next();
    }
}

abstract class State {
    ns: NS;
    host: string;

    constructor(ns: NS, host: string) {
        this.ns = ns;
        this.host = host;
    }

    abstract next(): State;
}

class StateWeaken extends State {
    pid: number;

    constructor(ns: NS, host: string) {
        super(ns, host);

        this.ns.killall(this.host);

        const numThreads = Math.floor(this.ns.getServerMaxRam(this.host) / 2.00);
        this.ns.tprint(`INFO: Spawning ${numThreads} threads for weaken on host ${this.host}`)
        const pid = this.ns.exec('hgw.js', this.host, {
            threads: numThreads,
            ramOverride: 2.00,
        }, `w -t ${numThreads} -i`);
        if (!pid) {
            throw "exec failed (possibly not enough ram)"
        }

        this.pid = pid;
    }

    next(): StateWeaken | StateCompleted {
        const script = this.ns.getRunningScript(this.pid);
        if (!script) {
            if (this.ns.getServerSecurityLevel(this.host) > this.ns.getServerMinSecurityLevel(this.host)) {
                throw "ERROR: weaken did not achieve target security level"
            }

            return new StateCompleted(this.ns, this.host);
        }

        return this
    }
}

class StateGrowWeaken extends State {
    growPid: number;
    weakenPid: number;

    constructor(ns: NS, host: string, growPid: number, weakenPid: number) {
        super(ns, host);
        this.growPid = growPid;
        this.weakenPid = weakenPid;
    }

    next(): State {
        return new StateCompleted(this.ns, this.host)
    }
}

class StateCompleted extends State {
    next(): StateCompleted {
        return this
    }
}

function crack(ns: NS, host: string): boolean {
    if (host === ns.getHostname()) {
        return false;
    }

    try {
        ns.brutessh(host);
        ns.ftpcrack(host);
    } catch (err) {
        ns.tprint(`ERROR: Couldn't open ports on host '${host}': ${err}`);
        return false;
    }

    if (ns.getServerRequiredHackingLevel(host) > ns.getHackingLevel()) {
        return false;
    }

    if (ns.getServerNumPortsRequired(host) > 1) {
        return false;
    }

    try {
        ns.nuke(host);
    } catch (err) {
        ns.tprint(`ERROR: Couldn't nuke host '${host}': ${err}`)
        return false;
    }

    return true;
}

function recursiveScan(ns: NS): string[] {
    let visited = new Set<string>();
    let stack = [ns.getHostname()]
    while (stack.length > 0) {
        let host = stack.pop();
        visited.add(host);
        stack.push(...ns.scan(host).filter(host => !visited.has(host)));
    }

    return Array.from(visited.keys());
}
