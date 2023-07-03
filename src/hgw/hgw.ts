import { NS } from '../types/NetscriptDefinitions';
import * as args from './args';

export async function main(ns: NS) {
    const argString = ns.args.join(' ');
    ns.tprint(`INFO: ${argString}`);
    const result = args.parse(argString);
    if (result.errs.length > 0) {
        for (const err of result.errs) {
            ns.tprint(`ERROR: ${err}`);
        }

        return;
    }

    const command = new TopLevelCommand(result.ast);
    ns.tprint(command.inner);
    await command.handle(ns);
}

class TopLevelCommand {
    inner: WeakenCommand;

    constructor(ast: args.command) {
        this.inner = new WeakenCommand(ast.cmd)
    }

    async handle(ns: NS) {
        await this.inner.handle(ns);
    }
}

class WeakenCommand {
    threads?: number;
    infinite?: boolean;

    constructor(ast: args.weakenCmd) {
        for (const flag of ast.flags) {
            switch (flag.flag.kind) {
                case args.ASTKinds.threadsFlag:
                    let z = flag.flag.threads
                    this.threads = flag.flag.threads.value;
                    break;
                case args.ASTKinds.infiniteFlag:
                    this.infinite = true
                    break;
            }
        }
    }

    async handle(ns: NS) {
        const host = ns.getHostname();

        let numRuns = 0;
        const minSecurityLevel = ns.getServerMinSecurityLevel(host)
        while (ns.getServerSecurityLevel(host) > minSecurityLevel && (this.infinite || numRuns == 0)) {
            const amountReduced = await ns.weaken(host, {
                threads: this.threads,
            });

            ns.printf(`INFO: reduced security level on ${host} by ${amountReduced} (now ${ns.getServerSecurityLevel(host).toFixed(2)}, min security level is ${minSecurityLevel})`)
            numRuns++;
        }

        ns.print(`SUCCESS: weakened ${host} to minimum security level`);
    }
}