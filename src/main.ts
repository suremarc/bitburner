import { NS } from './types/NetscriptDefinitions.d';

export async function main(ns: NS) {
    const targets = recursiveScan(ns).filter(host => crack(ns, host));

    ns.tprint(["INFO: Targets with root access:"].concat(targets).join('\n\t'))

    targets.forEach(host => {
        ns.rm('prepare.js', host);
        ns.scp(['weaken.js'], host);
    });

    let states: State[] = targets.map(host => new StateIdle(ns, host));

    ns.disableLog('sleep')
    while (await ns.sleep(100)) {
        states = states.map(state => state.next());

        if (states.filter(state => state instanceof StateErrored).length > 0) {
            ns.tprintf("halting due to error")
            break
        }

        if (states.filter(state => !(state instanceof StateCompleted)).length == 0) {
            ns.tprint(`All processes are completed, tearing down`)
            break
        }
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

class StateIdle extends State {
    next(): StateWeaken | StateErrored {
        this.ns.killall(this.host);

        try {
            const numThreads = Math.floor(this.ns.getServerMaxRam(this.host) / this.ns.getScriptRam('weaken.js', this.host));
            this.ns.tprint(`INFO: Spawning ${numThreads} threads for weaken on host ${this.host}`)
            const pid = this.ns.exec('weaken.js', this.host, numThreads, numThreads);
            if (!pid) {
                throw "exec failed (possibly not enough ram)"
            }

            return new StateWeaken(this.ns, this.host, pid);
        } catch (err) {
            this.ns.tprintf("ERROR: couldn't run weaken.js: %s", err)
            this.ns.killall(this.host);
            return new StateErrored(this.ns, this.host, err)
        }
    }
}

class StateWeaken extends State {
    pid: number;

    constructor(ns: NS, host: string, pid: number) {
        super(ns, host);
        this.pid = pid;
    }

    next(): StateWeaken | StateErrored | StateCompleted {
        const script = this.ns.getRunningScript(this.pid);
        if (!script) {
            if (this.ns.getServerSecurityLevel(this.host) > this.ns.getServerMinSecurityLevel(this.host)) {
                this.ns.tprint("ERROR: weaken did not achieve target security level");
                return new StateErrored(this.ns, this.host, "weaken did not achieve target security level");
            }

            return new StateCompleted(this.ns, this.host);
        }

        return this
    }
}

class StateErrored extends State {
    error: any;

    constructor(ns: NS, host: string, err: any) {
        super(ns, host);
        this.error = err;
    }

    next(): StateErrored {
        return this
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
