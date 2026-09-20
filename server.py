import http.server
import socketserver
import json
import os

PORT = 8000

class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_POST(self):
        if self.path == '/save':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            with open('data.json', 'wb') as f:
                f.write(post_data)
                
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b"OK")
        else:
            self.send_response(404)
            self.end_headers()

print("\n=================================================================")
print("✅ 자동 저장 서버가 시작되었습니다!")
print(f"👉 브라우저 주소창에 다음 주소를 복사해서 접속하세요:")
print(f"   http://localhost:{PORT}/TimeTracker.html")
print("=================================================================")
print("이 검은 창을 켜둔 상태로 브라우저에서 작업하시면,")
print("버튼을 누르지 않아도 모든 변경사항이 data.json에 100% 자동 저장됩니다.\n")

with socketserver.TCPServer(("", PORT), Handler) as httpd:
    httpd.serve_forever()
