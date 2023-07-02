import { NS } from './types/NetscriptDefinitions';

export async function main(ns: NS) {
    const host = ns.getHostname();
    const minimumSecurityLevel = Math.max(1, Math.round(ns.getServerBaseSecurityLevel(host) / 3));
    const numThreads = ns.args[0];
    if (typeof numThreads !== 'number') {
        ns.tprintf("ERROR: expected a number for arg #1 numThreads (got %s)", typeof numThreads);
        return;
    }

    while (ns.getServerSecurityLevel(host) > minimumSecurityLevel) {
        const amountReduced = await ns.weaken(host, {
            threads: numThreads,
        });

        ns.tprintf(`INFO: reduced security level on ${host} by ${amountReduced} (now ${ns.getServerSecurityLevel(host).toFixed(2)}, min security level is ${minimumSecurityLevel})`)
    }

    ns.tprint(`SUCCESS: weakened ${host} to minimum security level`);
}
