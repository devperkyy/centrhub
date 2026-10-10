#pragma once
#include <string>
namespace pipe_server {
    void run(const wchar_t* name);
    void send_log(const std::string& line);
}
