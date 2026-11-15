using System;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Threading;
using System.Diagnostics;
using System.Windows.Forms;

namespace LifeBlueprintPortable
{
    static class Program
    {
        private static string BaseDir;
        private static string AppDir;
        private static string DataDir;
        private static string DataFilePath;
        private static string BackupFilePath;
        private static volatile bool IsRunning = true;
        private static DateTime LastHeartbeat = DateTime.UtcNow;
        private static volatile bool ClientConnectedOnce = false;

        [STAThread]
        static void Main(string[] args)
        {
            BaseDir = AppDomain.CurrentDomain.BaseDirectory;
            AppDir = Path.Combine(BaseDir, "app");
            DataDir = Path.Combine(BaseDir, "data");
            DataFilePath = Path.Combine(DataDir, "life_blueprint.json");
            BackupFilePath = Path.Combine(DataDir, "life_blueprint.backup.json");

            if (!Directory.Exists(DataDir))
            {
                Directory.CreateDirectory(DataDir);
            }

            if (!Directory.Exists(AppDir))
            {
                MessageBox.Show("找不到 app 資料夾，請確認程式完整性。\nPath: " + AppDir, "北歐森林人生藍圖", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return;
            }

            bool serverOnly = false;
            int fixedPort = 17890;
            foreach (string arg in args)
            {
                if (arg == "--server-only") serverOnly = true;
                if (arg.StartsWith("--port=")) int.TryParse(arg.Substring(7), out fixedPort);
            }

            TcpListener listener = null;
            try
            {
                listener = new TcpListener(IPAddress.Loopback, fixedPort);
                listener.Start();
            }
            catch
            {
                // If default port 17890 is already running our server, just open the window to it
                if (fixedPort == 17890 && !serverOnly)
                {
                    LaunchStandaloneWindow("http://127.0.0.1:17890/");
                    return;
                }
                try
                {
                    listener = new TcpListener(IPAddress.Loopback, 0);
                    listener.Start();
                }
                catch (Exception ex)
                {
                    MessageBox.Show("無法啟動本地服務連接埠: " + ex.Message, "北歐森林人生藍圖", MessageBoxButtons.OK, MessageBoxIcon.Error);
                    return;
                }
            }

            int port = ((IPEndPoint)listener.LocalEndpoint).Port;
            string url = "http://127.0.0.1:" + port + "/";

            Thread serverThread = new Thread(() => RunServer(listener));
            serverThread.IsBackground = true;
            serverThread.Start();

            if (serverOnly)
            {
                Console.WriteLine("Server listening on " + url);
                while (IsRunning)
                {
                    Thread.Sleep(500);
                }
                return;
            }

            Process windowProc = LaunchStandaloneWindow(url);

            // Monitor lifecycle: stay alive until window sends /api/shutdown on close
            DateTime startTime = DateTime.UtcNow;
            while (IsRunning)
            {
                Thread.Sleep(1000);
                double elapsedSinceStart = (DateTime.UtcNow - startTime).TotalSeconds;
                double elapsedSinceHeartbeat = (DateTime.UtcNow - LastHeartbeat).TotalSeconds;

                if (ClientConnectedOnce)
                {
                    // Do not kill when window is minimized/backgrounded (browser throttles timers to 60s+).
                    // Only timeout if no heartbeat for > 6 hours and launched process has exited.
                    if (elapsedSinceHeartbeat > 21600 && (windowProc == null || windowProc.HasExited))
                    {
                        break;
                    }
                }
                else if (elapsedSinceStart > 60)
                {
                    break;
                }
            }

            try { listener.Stop(); } catch { }
        }

        private static Process LaunchStandaloneWindow(string url)
        {
            string[] candidates = new string[]
            {
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), @"Microsoft\Edge\Application\msedge.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), @"Microsoft\Edge\Application\msedge.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), @"Google\Chrome\Application\chrome.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), @"Google\Chrome\Application\chrome.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), @"Microsoft\Edge\Application\msedge.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), @"Google\Chrome\Application\chrome.exe")
            };

            string browserExe = null;
            foreach (string path in candidates)
            {
                if (!string.IsNullOrEmpty(path) && File.Exists(path))
                {
                    browserExe = path;
                    break;
                }
            }

            string profileDir = Path.Combine(DataDir, "window_profile");
            if (!Directory.Exists(profileDir))
            {
                Directory.CreateDirectory(profileDir);
            }

            if (browserExe != null)
            {
                ProcessStartInfo psi = new ProcessStartInfo();
                psi.FileName = browserExe;
                psi.Arguments = string.Format("--app=\"{0}\" --user-data-dir=\"{1}\" --window-size=1400,880 --disable-features=Translate --no-first-run --no-default-browser-check", url, profileDir);
                psi.UseShellExecute = false;
                try
                {
                    return Process.Start(psi);
                }
                catch { }
            }

            // Fallback to default system browser if Edge/Chrome not in standard location
            try
            {
                return Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
            }
            catch
            {
                return null;
            }
        }

        private static void RunServer(TcpListener listener)
        {
            while (IsRunning)
            {
                try
                {
                    TcpClient client = listener.AcceptTcpClient();
                    ThreadPool.QueueUserWorkItem(HandleClient, client);
                }
                catch
                {
                    if (!IsRunning) break;
                }
            }
        }

        private static void HandleClient(object obj)
        {
            using (TcpClient client = (TcpClient)obj)
            {
                try
                {
                    client.ReceiveTimeout = 10000;
                    client.SendTimeout = 10000;
                    using (NetworkStream stream = client.GetStream())
                    {
                        // Read HTTP headers
                        MemoryStream headerBuffer = new MemoryStream();
                        int b;
                        int state = 0; // looking for \r\n\r\n
                        while ((b = stream.ReadByte()) != -1)
                        {
                            headerBuffer.WriteByte((byte)b);
                            if (state == 0 && b == '\r') state = 1;
                            else if (state == 1 && b == '\n') state = 2;
                            else if (state == 2 && b == '\r') state = 3;
                            else if (state == 3 && b == '\n') { state = 4; break; }
                            else state = (b == '\r') ? 1 : 0;

                            if (headerBuffer.Length > 32768) break;
                        }

                        if (headerBuffer.Length == 0) return;

                        string headerText = Encoding.ASCII.GetString(headerBuffer.ToArray());
                        string[] lines = headerText.Split(new string[] { "\r\n" }, StringSplitOptions.None);
                        if (lines.Length == 0) return;

                        string[] requestParts = lines[0].Split(' ');
                        if (requestParts.Length < 2) return;

                        string method = requestParts[0].ToUpperInvariant();
                        string rawPath = requestParts[1];
                        string path = rawPath.Split('?')[0];

                        int contentLength = 0;
                        foreach (string line in lines)
                        {
                            if (line.StartsWith("Content-Length:", StringComparison.OrdinalIgnoreCase))
                            {
                                int.TryParse(line.Substring(15).Trim(), out contentLength);
                            }
                        }

                        byte[] bodyBytes = new byte[contentLength];
                        int totalRead = 0;
                        while (totalRead < contentLength)
                        {
                            int read = stream.Read(bodyBytes, totalRead, contentLength - totalRead);
                            if (read <= 0) break;
                            totalRead += read;
                        }

                        ClientConnectedOnce = true;
                        LastHeartbeat = DateTime.UtcNow;

                        // Route handling
                        if (path == "/api/heartbeat")
                        {
                            SendJsonResponse(stream, 200, "{\"ok\":true}");
                            return;
                        }

                        if (path == "/api/shutdown" && method == "POST")
                        {
                            SendJsonResponse(stream, 200, "{\"shuttingDown\":true}");
                            ThreadPool.QueueUserWorkItem(_ =>
                            {
                                Thread.Sleep(400);
                                // Double check no recent heartbeat arrived after shutdown signal (in case of page refresh)
                                if ((DateTime.UtcNow - LastHeartbeat).TotalMilliseconds >= 350)
                                {
                                    IsRunning = false;
                                }
                            });
                            return;
                        }

                        if (path == "/api/apikey" && method == "GET")
                        {
                            string keyPath = Path.Combine(DataDir, "apikey.local");
                            string keyVal = File.Exists(keyPath) ? File.ReadAllText(keyPath, Encoding.UTF8).Trim() : "";
                            SendJsonResponse(stream, 200, "{\"apiKey\":\"" + keyVal.Replace("\\", "\\\\").Replace("\"", "\\\"") + "\"}");
                            return;
                        }

                        if (path == "/api/apikey" && method == "POST")
                        {
                            string keyBody = Encoding.UTF8.GetString(bodyBytes, 0, totalRead).Trim();
                            string keyPath = Path.Combine(DataDir, "apikey.local");
                            File.WriteAllText(keyPath, keyBody, new UTF8Encoding(false));
                            SendJsonResponse(stream, 200, "{\"saved\":true}");
                            return;
                        }

                        if (path == "/api/github-sync-config" && method == "GET")
                        {
                            string syncPath = Path.Combine(DataDir, "github_sync.local");
                            string syncVal = File.Exists(syncPath) ? File.ReadAllText(syncPath, Encoding.UTF8).Trim() : "{}";
                            SendJsonResponse(stream, 200, string.IsNullOrEmpty(syncVal) ? "{}" : syncVal);
                            return;
                        }

                        if (path == "/api/github-sync-config" && method == "POST")
                        {
                            string syncBody = Encoding.UTF8.GetString(bodyBytes, 0, totalRead).Trim();
                            string syncPath = Path.Combine(DataDir, "github_sync.local");
                            File.WriteAllText(syncPath, syncBody, new UTF8Encoding(false));
                            SendJsonResponse(stream, 200, "{\"saved\":true}");
                            return;
                        }

                        if (path == "/api/data" && method == "GET")
                        {
                            if (File.Exists(DataFilePath))
                            {
                                byte[] data = File.ReadAllBytes(DataFilePath);
                                SendResponse(stream, 200, "application/json; charset=utf-8", data);
                            }
                            else
                            {
                                SendJsonResponse(stream, 200, "null");
                            }
                            return;
                        }

                        if (path == "/api/data" && method == "POST")
                        {
                            string jsonBody = Encoding.UTF8.GetString(bodyBytes, 0, totalRead);
                            if (!string.IsNullOrWhiteSpace(jsonBody))
                            {
                                lock (DataFilePath)
                                {
                                    if (File.Exists(DataFilePath))
                                    {
                                        try { File.Copy(DataFilePath, BackupFilePath, true); } catch { }
                                    }
                                    File.WriteAllText(DataFilePath, jsonBody, new UTF8Encoding(false));
                                }
                                SendJsonResponse(stream, 200, "{\"saved\":true,\"path\":\"data/life_blueprint.json\"}");
                            }
                            else
                            {
                                SendJsonResponse(stream, 400, "{\"error\":\"Empty body\"}");
                            }
                            return;
                        }

                        if (path == "/api/open-folder" && method == "POST")
                        {
                            try
                            {
                                Process.Start("explorer.exe", "\"" + DataDir + "\"");
                            }
                            catch { }
                            SendJsonResponse(stream, 200, "{\"ok\":true}");
                            return;
                        }

                        // Serve static files from AppDir
                        if (path == "/" || string.IsNullOrEmpty(path)) path = "/index.html";
                        string safeRelPath = path.TrimStart('/').Replace('/', Path.DirectorySeparatorChar);
                        if (safeRelPath.Contains(".."))
                        {
                            SendJsonResponse(stream, 403, "{\"error\":\"Forbidden\"}");
                            return;
                        }

                        string fullFilePath = Path.Combine(AppDir, safeRelPath);
                        if (File.Exists(fullFilePath))
                        {
                            byte[] fileBytes = File.ReadAllBytes(fullFilePath);
                            string mime = GetMimeType(fullFilePath);
                            SendResponse(stream, 200, mime, fileBytes);
                        }
                        else
                        {
                            SendJsonResponse(stream, 404, "{\"error\":\"Not found\"}");
                        }
                    }
                }
                catch
                {
                    // Ignore transient socket disconnects
                }
            }
        }

        private static string GetMimeType(string filePath)
        {
            string ext = Path.GetExtension(filePath).ToLowerInvariant();
            switch (ext)
            {
                case ".html": return "text/html; charset=utf-8";
                case ".css": return "text/css; charset=utf-8";
                case ".js": return "application/javascript; charset=utf-8";
                case ".json": return "application/json; charset=utf-8";
                case ".svg": return "image/svg+xml";
                case ".ico": return "image/x-icon";
                case ".png": return "image/png";
                default: return "application/octet-stream";
            }
        }

        private static void SendJsonResponse(NetworkStream stream, int statusCode, string json)
        {
            byte[] bytes = Encoding.UTF8.GetBytes(json);
            SendResponse(stream, statusCode, "application/json; charset=utf-8", bytes);
        }

        private static void SendResponse(NetworkStream stream, int statusCode, string contentType, byte[] body)
        {
            string statusText = statusCode == 200 ? "OK" : (statusCode == 404 ? "Not Found" : "Error");
            string header = string.Format(
                "HTTP/1.1 {0} {1}\r\n" +
                "Content-Type: {2}\r\n" +
                "Content-Length: {3}\r\n" +
                "Cache-Control: no-store, no-cache, must-revalidate\r\n" +
                "Access-Control-Allow-Origin: *\r\n" +
                "Connection: close\r\n\r\n",
                statusCode, statusText, contentType, body.Length);

            byte[] headerBytes = Encoding.ASCII.GetBytes(header);
            stream.Write(headerBytes, 0, headerBytes.Length);
            stream.Write(body, 0, body.Length);
            stream.Flush();
        }
    }
}
