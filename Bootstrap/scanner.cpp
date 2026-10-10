// language: C++20, file: scanner.cpp
// IDA-style pattern scanner. Signatures ARE per-client-build - re-derive after Roblox update.
#include "scanner.h"
#include <windows.h>
#include <vector>

namespace scanner {

uintptr_t module_base(const wchar_t* name) {
    return reinterpret_cast<uintptr_t>(GetModuleHandleW(name));
}

static std::vector<int> parse(std::string_view s) {
    std::vector<int> out;
    for (size_t i = 0; i < s.size();) {
        if (s[i] == ' ') { i++; continue; }
        if (s[i] == '?') { out.push_back(-1); i += (i + 1 < s.size() && s[i+1] == '?') ? 2 : 1; continue; }
        auto hex = [](char c){ return c>='0'&&c<='9'?c-'0':(c>='a'&&c<='f'?c-'a'+10:(c>='A'&&c<='F'?c-'A'+10:-1)); };
        int hi = hex(s[i]), lo = hex(s[i+1]);
        if (hi<0||lo<0) break;
        out.push_back((hi<<4)|lo);
        i += 2;
    }
    return out;
}

uintptr_t find_pattern(uintptr_t base, size_t size, std::string_view pat) {
    auto p = parse(pat);
    const uint8_t* data = reinterpret_cast<const uint8_t*>(base);
    for (size_t i = 0; i + p.size() <= size; i++) {
        bool ok = true;
        for (size_t j = 0; j < p.size(); j++) {
            if (p[j] == -1) continue;
            if (data[i + j] != (uint8_t)p[j]) { ok = false; break; }
        }
        if (ok) return base + i;
    }
    return 0;
}

uintptr_t scan(std::string_view pat) {
    auto base = module_base(L"RobloxPlayerBeta.exe");
    if (!base) base = module_base(L"RobloxPlayerBeta.dll");
    if (!base) return 0;
    auto dos = (IMAGE_DOS_HEADER*)base;
    auto nt  = (IMAGE_NT_HEADERS64*)(base + dos->e_lfanew);
    return find_pattern(base, nt->OptionalHeader.SizeOfImage, pat);
}

} // namespace scanner
