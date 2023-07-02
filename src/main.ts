import { NS } from 'types/NetscriptDefinitions.d';

export async function main(ns: NS) {
    ns.print("Starting script here");
    await ns.hack("foodnstuff"); //Use Netscript hack function
    ns.print(ns.args);           //The script arguments must be prefaced with ns as well
}
