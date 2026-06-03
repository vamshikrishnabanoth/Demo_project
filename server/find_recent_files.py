import os
import glob
import pandas as pd

def check_file(file_path):
    try:
        if file_path.endswith('.csv'):
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                lines = f.readlines()
                if len(lines) > 100:
                    print(f"CSV: {file_path} | Lines: {len(lines)}")
                    # print first 3 lines
                    for line in lines[:3]:
                        print("  ", line.strip())
        elif file_path.endswith(('.xlsx', '.xls')):
            df = pd.read_excel(file_path)
            if len(df) > 100:
                print(f"Excel: {file_path} | Rows: {len(df)}")
                print("   Columns:", df.columns.tolist())
                print("   First row:", df.iloc[0].to_dict())
    except Exception as e:
        pass

def main():
    print("Searching for files with >100 rows...")
    paths = [
        r"C:\Users\samanvi\OneDrive\Desktop\*",
        r"C:\Users\samanvi\OneDrive\Desktop\*\*",
        r"C:\Users\samanvi\Downloads\*",
        r"C:\Users\samanvi\Downloads\*\*",
    ]
    
    for pattern in paths:
        for file_path in glob.glob(pattern):
            if file_path.endswith(('.csv', '.xlsx', '.xls', '.txt')):
                check_file(file_path)

if __name__ == "__main__":
    main()
