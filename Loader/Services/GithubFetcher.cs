// Accept any github blob or raw url, resolve to raw, fetch body
using System;
using System.Net.Http;
using System.Threading.Tasks;

namespace RobloxExecutor.Services;

public static class GithubFetcher
{
    private static readonly HttpClient _http = new() { Timeout = TimeSpan.FromSeconds(20) };

    public static async Task<(string name, string body)> FetchAsync(string url)
    {
        var raw = Normalize(url.Trim());
        var body = await _http.GetStringAsync(raw);
        var name = raw.Substring(raw.LastIndexOf('/') + 1);
        if (!name.EndsWith(".lua", StringComparison.OrdinalIgnoreCase)) name += ".lua";
        return (name, body);
    }

    private static string Normalize(string url)
    {
        // github.com/<u>/<r>/blob/<branch>/<path>  ->  raw.githubusercontent.com/<u>/<r>/<branch>/<path>
        if (url.Contains("github.com") && url.Contains("/blob/"))
            return url.Replace("github.com", "raw.githubusercontent.com").Replace("/blob/", "/");
        if (url.StartsWith("gh:"))
        {
            // shorthand gh:user/repo@branch/path.lua
            var rest = url.Substring(3);
            var at = rest.IndexOf('@');
            var branch = "main"; var head = rest;
            if (at >= 0) { branch = rest.Substring(at + 1).Split('/')[0]; head = rest.Substring(0, at); }
            var slash = rest.IndexOf('/', at >= 0 ? at + branch.Length + 1 : 0);
            return $"https://raw.githubusercontent.com/{head}/{branch}/{rest.Substring(slash + 1)}";
        }
        return url;
    }
}
