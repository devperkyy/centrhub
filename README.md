# VANTA — Luau script executor

A sleek dark-mode WPF loader → native injector → bootstrap DLL with embedded Luau VM bridge.
Loads GitHub-hosted or local Luau scripts into the Roblox client at executor-level identity.

## Build

Open `RobloxExecutor.sln` in Visual Studio 2022, select **Release · x64**, Build Solution.

- `Loader` (.NET 8 WPF) → `RobloxExecutor.exe` (the UI)
- `Injector` (C++20) → `Injector.exe` (manual-mapper)
- `Bootstrap` (C++20) → `Bootstrap.dll` (payload DLL)

Copy `Injector.exe` and `Bootstrap.dll` next to `RobloxExecutor.exe`.

## Luau compiler

`Bootstrap` references `luau_compile` and the Luau Closure layout. Clone
`github.com/luau-lang/luau`, build `Luau.Compiler` static lib, add it to Bootstrap's
Additional Dependencies. Headers in Luau/VM/include and Luau/Compiler/include.

## Deriving signatures (per Roblox version)

The four sigs in `Bootstrap/luau_bridge.cpp` rot on every major client update. To refresh:

1. Open `RobloxPlayerBeta.exe` in IDA / Ghidra. Let auto-analysis finish.
2. Find `rbx::ScriptContext::getGlobalState` — xrefs string "ScriptContext" / "getGlobalState".
   Its wrapper that takes `(int identity)` is `getstate`. Dump 12 bytes of its prologue
   as a sig, wildcarding any absolute offsets (`? ? ? ?`).
3. `luau_load` — xrefs the string `"@"` used as default chunkname, or trace from the
   `loadstring` global's C function.
4. `lua_pcall` thunk — xrefs the string `"attempt to call a %s value"`.
5. `task.defer` C impl — xrefs string `"defer"` registered into the task table.
6. Paste the sigs into `luau_bridge.cpp` and rebuild Bootstrap.

Luau Closure struct offsets: compare `src/lobject.h` on the Luau tag matching the
Roblox commit (Roblox cuts from a specific commit). Byte offsets of `isC`, `nupvalues`,
`l.p`, `c.f`, `env` must line up.

## Hyperion / Byfron

Current retail Roblox ships with Hyperion (usermode anti-tamper). CreateRemoteThread
and LoadLibrary are hooked; manual-map still works on process start before Hyperion's
syscall hooks arm, but misses on an attached process. Options:

- **Early-launch:** patch `RobloxPlayerLauncher` to spawn `RobloxPlayerBeta.exe`
  **suspended**, inject before resuming — Hyperion arms after process init. Reliable.
- **Kernel driver:** signed-driver abuse or BYOVD (bring your own vulnerable driver,
  e.g. `dbutil_2_3.sys`, `RTCore64.sys`). Mapper lives in the driver; usermode remains
  invisible. This is the path commercial executors take; architecture outside this repo.
- **Clean target:** Roblox Studio in test mode (no Hyperion) and UWP builds (varied)
  take the usermode path straight away. Good for dev + verifying the Luau bridge.

Nothing static survives Hyperion long. Signatures and offsets re-derive weekly.

## UI

- Custom chrome, Mica backdrop (Win11), 12-px rounded shell
- Side nav: Executor / Scripts / Settings
- AvalonEdit with Luau syntax highlighting
- Console pane streams `[VANTA]` logs from Bootstrap over the pipe
- Scripts view: paste any `github.com/.../blob/.../x.lua` or `raw.githubusercontent.com/...`
  or shorthand `gh:user/repo@branch/path.lua` → one-click import to local library

## Running a Da Hood loadout

1. Build. Place `Injector.exe` + `Bootstrap.dll` + `Luau.Compiler.lib` dependencies
   next to the loader.
2. Launch Roblox and join Da Hood.
3. Open VANTA → **Attach** (icon in the action bar).
4. Open `Scripts/DaHood.lua`, paste into the editor, hit **Execute**.

The in-game overlay opens on `RightShift`.

## Early-launch patcher (`EarlyLaunch.exe`)

Beats usermode Hyperion by catching the client while its syscall hooks aren't armed yet.

```
EarlyLaunch.exe [path\to\RobloxPlayerBeta.exe] [game args] [-dll Bootstrap.dll]
```

Omit the path and it reads `HKCU\Software\ROBLOX Corporation\Environments\roblox-player\clientExe`.

Flow: `CreateProcessW(CREATE_SUSPENDED)` → tiny settle → `manual_map(Bootstrap.dll)` →
`ResumeThread`. The DLL is in-process before Roblox hits its first user code.

## BYOVD mapper (`Mapper.exe`)

Signed-driver primitive via **RTCore64.sys** (MSI Afterburner, CVE-2019-16098). The
driver stays loaded; our usermode exe talks IOCTLs for arbitrary physical read/write.
With phys-r we walk ntoskrnl's EPROCESS linked list to pull Roblox's CR3, with phys-w
we drop Bootstrap.dll straight onto the target's backing pages — Hyperion's usermode
NT syscall hooks never see the memory touches because they travel kernel-side.

```
Mapper.exe <pid> Bootstrap.dll
```

Supply yourself:
- **RTCore64.sys** — ship with MSI Afterburner installer, or grab from
  the LOLDrivers list. Place next to `Mapper.exe`.
- EPROCESS field offsets in `Mapper/mem_translate.cpp` → refresh after a Patch Tuesday:
  WinDbg → `dt nt!_EPROCESS -r` → copy `UniqueProcessId`, `ActiveProcessLinks`,
  `ImageFileName`, `DirectoryTableBase` offsets into `K_OFFS`.
- `PS_INITIAL_SYSTEM_PROCESS_RVA` in `Mapper/main.cpp` from
  `kd> x nt!PsInitialSystemProcess`.

HVCI / Memory Integrity: if the user has it on, RTCore64 won't load. Options from there:
- a different unblocked signed driver (LOLDrivers has 1000+ vulnerable ones; `dbutil_2_3.sys`,
  `AMDRyzenMasterDriver.sys`, `ene.sys` are still unblocked at the time of writing)
- vulnerable-driver swap requires only re-pointing the IOCTL codes + packet layout in `phys_io.cpp`.
