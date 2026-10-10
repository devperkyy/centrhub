#pragma once
#include <string>
namespace luau {
    bool init();
    std::string execute(const std::string& source);
    // raw lua_State* obtained from Roblox scheduler
    void* L();
}
