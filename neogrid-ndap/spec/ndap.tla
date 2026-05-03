---- MODULE NDAP ----
(*
 * NeoGrid NDAP — Formal TLA+ specification
 *
 * Models the core state machine of the NeoGrid DID Asset Protocol:
 *   - Asset ownership is tracked in a finite map (assets).
 *   - Every state transition is appended to an immutable log.
 *   - Ownership transfers are atomic and traceable.
 *)

EXTENDS Sequences, FiniteSets, Naturals

VARIABLES assets, log

TypeInvariant ==
    /\ DOMAIN assets \subseteq STRING
    /\ \A id \in DOMAIN assets : assets[id] \in STRING
    /\ log \in Seq([from: STRING, to: STRING, key: STRING])

Init ==
    /\ assets = [id \in {} |-> ""]
    /\ log = << >>

Transfer(key, from, to) ==
    /\ key \in DOMAIN assets
    /\ assets[key] = from
    /\ assets' = [assets EXCEPT ![key] = to]
    /\ log' = Append(log, [from |-> from, to |-> to, key |-> key])

Register(key, owner) ==
    /\ key \notin DOMAIN assets
    /\ assets' = assets @@ (key :> owner)
    /\ log' = Append(log, [from |-> "", to |-> owner, key |-> key])

Next ==
    \/ \E key, from, to \in STRING : Transfer(key, from, to)
    \/ \E key, owner \in STRING    : Register(key, owner)

Spec ==
    Init /\ [][Next]_<<assets, log>>

(*
 * Safety properties
 *)

NoDoubleOwner ==
    \A k \in DOMAIN assets : \E owner \in STRING : assets[k] = owner

LogGrowsMonotonically ==
    [][Len(log') >= Len(log)]_log

====
