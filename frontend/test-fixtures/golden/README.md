# Golden Protocol Trace Format

T5 provides only a synthetic schema seed. It is not a captured Unity trace.
T26 must capture real Unity WebSocket payloads, parse them, remove timestamps and
connection-specific fields, normalize with `src/protocol/capture.ts`, then append
one JSON object per line to a trace file in this directory.

Each JSONL record has this shape:

```json
{
  "direction": "sent|received",
  "uri": "command.example",
  "uid": "Player-7",
  "frame": { "uid": "Player-7", "uri": "command.example", "method": null, "data": {} }
}
```

`uid` is optional because `welcome` does not guarantee one. `frame` is the parsed,
normalized protocol envelope and retains the exact data shape used for replay.
