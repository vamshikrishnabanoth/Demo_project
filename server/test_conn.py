import os
import psycopg2
from dotenv import load_dotenv

# Load env
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '.env'))
DATABASE_URL = os.getenv("DATABASE_URL")
print("DATABASE_URL:", DATABASE_URL)

try:
    print("Attempting default connection...")
    conn = psycopg2.connect(DATABASE_URL)
    print("SUCCESS: Default connection succeeded!")
    conn.close()
except Exception as e:
    print("FAIL: Default connection failed:", str(e))

try:
    print("Attempting connection with sslmode=require...")
    conn_str = DATABASE_URL
    if "sslmode" not in conn_str:
        if "?" in conn_str:
            conn_str += "&sslmode=require"
        else:
            conn_str += "?sslmode=require"
    conn = psycopg2.connect(conn_str)
    print("SUCCESS: sslmode=require succeeded!")
    conn.close()
except Exception as e:
    print("FAIL: sslmode=require failed:", str(e))
