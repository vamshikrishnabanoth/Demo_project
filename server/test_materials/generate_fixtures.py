import os
import zipfile
import matplotlib.pyplot as plt
from matplotlib.backends.backend_pdf import PdfPages
from PIL import Image, ImageDraw

def generate_all():
    base_dir = os.path.dirname(__file__)
    os.makedirs(base_dir, exist_ok=True)

    # ──────────────────────────────────────────────────────────────────────────
    # 1. pdf_table_algorithms.pdf (Real PDF with selectable text & Markdown table)
    # ──────────────────────────────────────────────────────────────────────────
    table_pdf_path = os.path.join(base_dir, 'pdf_table_algorithms.pdf')
    with PdfPages(table_pdf_path) as pdf:
        fig, ax = plt.subplots(figsize=(8.5, 11))
        ax.axis('off')
        
        y = 0.95
        def add_line(text, size=11, bold=False):
            nonlocal y
            weight = 'bold' if bold else 'normal'
            ax.text(0.08, y, text, fontsize=size, weight=weight, fontfamily='sans-serif')
            y -= 0.032

        add_line("Computational Complexity of Sorting Algorithms and Space Efficiency", size=14, bold=True)
        y -= 0.01
        add_line("Introduction to Algorithm Complexity Analysis", size=12, bold=True)
        add_line("Sorting algorithms are foundational procedures in computer science that arrange items.")
        add_line("The computational efficiency of an algorithm is analyzed using asymptotic Big-O notation.")
        add_line("Both worst-case time complexity and auxiliary space overhead are decisive metrics.")
        y -= 0.015
        add_line("Algorithm Efficiency and Resource Consumption Table:", size=12, bold=True)
        add_line("Algorithm | Time Complexity | Space Complexity", bold=True)
        add_line("Merge Sort | O(n log n) | O(n)")
        add_line("Quick Sort | O(n log n) average | O(log n)")
        add_line("Bubble Sort | O(n^2) | O(1)")
        add_line("Heap Sort | O(n log n) | O(1)")
        y -= 0.015
        add_line("Auxiliary Space and In-Place Sorting Characteristics", size=12, bold=True)
        add_line("Notice that Merge Sort requires O(n) auxiliary space because of temporary subarrays.")
        add_line("In contrast, Bubble Sort and Heap Sort operate strictly in-place with O(1) auxiliary space.")
        add_line("Quick Sort requires O(log n) auxiliary stack space for its recursive partitioning stack.")
        add_line("Stability: Merge Sort and Bubble Sort are stable, while Quick Sort and Heap Sort are not.")
        
        pdf.savefig(fig)
        plt.close()
    print(f"[OK] Generated: {table_pdf_path}")

    # ──────────────────────────────────────────────────────────────────────────
    # 2. pdf_chart_sales.pdf (Real PDF containing Sales Bar Chart)
    # ──────────────────────────────────────────────────────────────────────────
    chart_pdf_path = os.path.join(base_dir, 'pdf_chart_sales.pdf')
    fig, ax = plt.subplots(figsize=(10, 7), dpi=150)
    years = ['2021', '2022', '2023', '2024']
    sales = [100, 140, 180, 160]
    bars = ax.bar(years, sales, color='#2980b9', width=0.5)
    ax.set_ylabel('Sales Revenue in USD Millions', fontsize=12)
    ax.set_xlabel('Calendar Year', fontsize=12)
    ax.set_title('Corporate Financial Performance: Annual Sales Revenue (2021-2024)', fontsize=14, weight='bold')
    ax.set_ylim(0, 220)
    for bar in bars:
        yval = bar.get_height()
        ax.text(bar.get_x() + bar.get_width()/2.0, yval + 5, f"{int(yval)}M", ha='center', va='bottom', fontsize=11, weight='bold')
    ax.text(0.02, -0.15, "Economic Analysis: Annual sales revenue is an essential metric measuring financial performance and enterprise growth.", transform=ax.transAxes, fontsize=10)
    ax.text(0.02, -0.20, "Trend Observation: Peak revenue occurred in 2023 at 180 Million USD, while minimum revenue was 100 Million USD in 2021.", transform=ax.transAxes, fontsize=10)
    ax.text(0.02, -0.25, "Intermediate Performance: Revenue expanded to 140 Million USD in 2022 before adjusting to 160 Million USD in 2024.", transform=ax.transAxes, fontsize=10)
    plt.tight_layout()
    plt.savefig(chart_pdf_path)
    plt.close()
    print(f"[OK] Generated: {chart_pdf_path}")

    # ──────────────────────────────────────────────────────────────────────────
    # 3. pdf_diagram_architecture.pdf (System Architecture Diagram)
    # ──────────────────────────────────────────────────────────────────────────
    diag_img = Image.new('RGB', (1000, 850), color=(255, 255, 255))
    d = ImageDraw.Draw(diag_img)
    d.text((50, 30), "Enterprise Distributed Web Architecture", fill=(20, 20, 20))
    d.text((50, 60), "End-to-End Request Pipeline & Component Hierarchy", fill=(80, 80, 80))

    nodes = [
        ("Client Browser", "Initiates secure HTTPS requests over public network", 110, (235, 245, 251), (41, 128, 185)),
        ("API Gateway", "Performs TLS termination, authentication & rate limiting", 240, (234, 250, 241), (39, 174, 96)),
        ("Load Balancer", "Distributes traffic across server instances using round-robin", 370, (254, 249, 231), (241, 196, 15)),
        ("Application Server", "Executes business logic, microservices & controller routines", 500, (253, 237, 236), (231, 76, 60)),
        ("Database Cluster", "Stores ACID relational records with read-replicas & caching", 630, (244, 236, 247), (142, 68, 173)),
    ]

    for title, desc, y_pos, bg_color, border_color in nodes:
        d.rectangle([(200, y_pos), (800, y_pos + 80)], fill=bg_color, outline=border_color, width=3)
        d.text((230, y_pos + 15), f"Component: {title}", fill=(10, 10, 10))
        d.text((230, y_pos + 45), desc, fill=(60, 60, 60))

    arrow_positions = [(190, 240), (320, 370), (450, 500), (580, 630)]
    for y_start, y_end in arrow_positions:
        d.line([(500, y_start), (500, y_end)], fill=(50, 50, 50), width=4)
        d.polygon([(490, y_end - 10), (510, y_end - 10), (500, y_end)], fill=(50, 50, 50))

    d.text((50, 750), "Architecture Summary Note:", fill=(20, 20, 20))
    d.text((50, 775), "• The Load Balancer receives traffic from the API Gateway before routing to the Application Server.", fill=(40, 40, 40))
    d.text((50, 800), "• High availability is maintained by health checks conducted by the Load Balancer.", fill=(40, 40, 40))

    diag_pdf_path = os.path.join(base_dir, 'pdf_diagram_architecture.pdf')
    diag_img.save(diag_pdf_path, 'PDF', resolution=100.0)
    print(f"[OK] Generated: {diag_pdf_path}")

    # ──────────────────────────────────────────────────────────────────────────
    # 4. scanned_multipage.pdf (4-Page Scanned PDF)
    # ──────────────────────────────────────────────────────────────────────────
    p1 = Image.new('RGB', (900, 650), color=(255, 255, 255))
    d1 = ImageDraw.Draw(p1)
    d1.text((40, 40), "Chapter 7: Distributed Systems Consensus", fill=(0, 0, 0))
    d1.text((40, 80), "Distributed consensus ensures that multiple nodes agree on a state value.", fill=(20, 20, 20))
    d1.text((40, 120), "The Raft consensus protocol achieves state machine replication via an elected leader.", fill=(20, 20, 20))
    d1.text((40, 160), "Raft decomposes consensus into leader election, log replication, and safety guarantees.", fill=(20, 20, 20))
    d1.text((40, 200), "Nodes in Raft exist in one of three states: Leader, Follower, or Candidate.", fill=(20, 20, 20))
    d1.text((40, 580), "[Document Provenance: Page 1 of 4 - Distributed Consensus Foundations]", fill=(100, 100, 100))

    p2 = Image.new('RGB', (900, 650), color=(255, 255, 255))
    d2 = ImageDraw.Draw(p2)
    d2.text((40, 40), "Comparative Analysis of Consensus Protocols", fill=(0, 0, 0))
    d2.text((40, 80), "The following table details protocol complexities and guarantees:", fill=(20, 20, 20))
    t_lines = [
        "Protocol | Leader Model | Fault Tolerance | Understandability",
        "Raft | Strong Single Leader | Majority (N/2 + 1) | High",
        "Multi-Paxos | Weak/Multi Leader | Majority (N/2 + 1) | Low",
        "Zab (ZooKeeper) | Primary-Backup | Majority (N/2 + 1) | Moderate",
        "PBFT | View-Change Leader | (3f + 1) nodes | Complex"
    ]
    y_off = 130
    for l in t_lines:
        d2.text((40, y_off), l, fill=(0, 0, 0))
        y_off += 35
    d2.text((40, y_off + 40), "A Raft cluster of 5 nodes can continue operating properly despite 2 node failures.", fill=(30, 30, 30))
    d2.text((40, 580), "[Document Provenance: Page 2 of 4 - Protocol Comparison Table]", fill=(100, 100, 100))

    p3 = Image.new('RGB', (900, 650), color=(255, 255, 255))
    d3 = ImageDraw.Draw(p3)
    d3.text((40, 40), "Raft Node State Machine Diagram", fill=(0, 0, 0))
    d3.text((40, 90), "[Follower State] --(election timeout)--> [Candidate State]", fill=(0, 0, 0))
    d3.text((40, 140), "[Candidate State] --(votes from majority)--> [Leader State]", fill=(0, 0, 0))
    d3.text((40, 190), "[Candidate State] --(discovers new leader)--> [Follower State]", fill=(0, 0, 0))
    d3.text((40, 240), "[Leader State] --(discovers term > currentTerm)--> [Follower State]", fill=(0, 0, 0))
    d3.text((40, 310), "Heartbeats: The Leader sends periodic AppendEntries RPCs with no log entries.", fill=(30, 30, 30))
    d3.text((40, 350), "If followers receive heartbeats before their election timeout, they remain followers.", fill=(30, 30, 30))
    d3.text((40, 580), "[Document Provenance: Page 3 of 4 - State Machine Diagram]", fill=(100, 100, 100))

    p4 = Image.new('RGB', (900, 650), color=(255, 255, 255))
    d4 = ImageDraw.Draw(p4)
    d4.text((40, 40), "Byzantine Fault Tolerance and Network Partitions", fill=(0, 0, 0))
    d4.text((40, 80), "Crash fault tolerance assumes nodes fail by stopping, not by lying or sending corrupt packets.", fill=(20, 20, 20))
    d4.text((40, 120), "Raft and Paxos handle crash fault tolerance (CFT).", fill=(20, 20, 20))
    d4.text((40, 160), "During a network partition, only the partition containing a strict majority can commit entries.", fill=(20, 20, 20))
    d4.text((40, 200), "The minority partition cannot achieve quorum and rejects write requests.", fill=(20, 20, 20))
    d4.text((40, 580), "[Document Provenance: Page 4 of 4 - Fault Tolerance and Partitions]", fill=(100, 100, 100))

    multi_pdf_path = os.path.join(base_dir, 'scanned_multipage.pdf')
    p1.save(multi_pdf_path, 'PDF', save_all=True, append_images=[p2, p3, p4], resolution=100.0)
    print(f"[OK] Generated: {multi_pdf_path}")

    # ──────────────────────────────────────────────────────────────────────────
    # 5. docx_mixed_content.docx
    # ──────────────────────────────────────────────────────────────────────────
    base_docx = os.path.join(os.path.dirname(__file__), '..', 'node_modules', 'mammoth', 'test', 'test-data', 'tables.docx')
    out_mixed_docx = os.path.join(base_dir, 'docx_mixed_content.docx')

    mixed_doc_xml = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>
  <w:p><w:r><w:t>Modern Cloud Microservices Architecture</w:t></w:r></w:p>
  <w:p><w:r><w:t>Overview of Service Mesh Design</w:t></w:r></w:p>
  <w:p><w:r><w:t>In modern cloud engineering, microservices communicate using synchronous RPCs and asynchronous event buses. A service mesh adds a transparent proxy sidecar to every pod, decoupling traffic routing, security, and telemetry from application business logic.</w:t></w:r></w:p>
  
  <w:tbl>
    <w:tr>
      <w:tc><w:p><w:r><w:t>Protocol</w:t></w:r></w:p></w:tc>
      <w:tc><w:p><w:r><w:t>Transport</w:t></w:r></w:p></w:tc>
      <w:tc><w:p><w:r><w:t>Serialization</w:t></w:r></w:p></w:tc>
      <w:tc><w:p><w:r><w:t>Typical Latency</w:t></w:r></w:p></w:tc>
    </w:tr>
    <w:tr>
      <w:tc><w:p><w:r><w:t>gRPC</w:t></w:r></w:p></w:tc>
      <w:tc><w:p><w:r><w:t>HTTP/2 Multiplexed</w:t></w:r></w:p></w:tc>
      <w:tc><w:p><w:r><w:t>Protocol Buffers (Binary)</w:t></w:r></w:p></w:tc>
      <w:tc><w:p><w:r><w:t>Sub-millisecond (&lt; 2ms)</w:t></w:r></w:p></w:tc>
    </w:tr>
    <w:tr>
      <w:tc><w:p><w:r><w:t>REST over HTTP/1.1</w:t></w:r></w:p></w:tc>
      <w:tc><w:p><w:r><w:t>TCP Connection per request</w:t></w:r></w:p></w:tc>
      <w:tc><w:p><w:r><w:t>JSON Text</w:t></w:r></w:p></w:tc>
      <w:tc><w:p><w:r><w:t>15ms - 50ms</w:t></w:r></w:p></w:tc>
    </w:tr>
    <w:tr>
      <w:tc><w:p><w:r><w:t>GraphQL</w:t></w:r></w:p></w:tc>
      <w:tc><w:p><w:r><w:t>HTTP/1.1 or HTTP/2</w:t></w:r></w:p></w:tc>
      <w:tc><w:p><w:r><w:t>JSON Text</w:t></w:r></w:p></w:tc>
      <w:tc><w:p><w:r><w:t>20ms - 80ms</w:t></w:r></w:p></w:tc>
    </w:tr>
  </w:tbl>

  <w:p><w:r><w:t>Ingress and Egress Management</w:t></w:r></w:p>
  <w:p><w:r><w:t>All inbound user traffic reaches the API Gateway and Ingress Controller before being distributed to individual microservices. Sidecar proxies enforce mutual TLS (mTLS) between microservices.</w:t></w:r></w:p>
  <w:p><w:r><w:t>Figure 1: Service Mesh Architecture and Ingress Traffic Routing</w:t></w:r></w:p>
  <w:p><w:r><w:t>The diagram illustrates how incoming traffic traverses from the external client to the ingress controller, passes through the envoy sidecar proxy, and finally reaches the backend database.</w:t></w:r></w:p>
</w:body>
</w:document>"""

    with zipfile.ZipFile(base_docx, 'r') as zin:
        with zipfile.ZipFile(out_mixed_docx, 'w') as zout:
            for item in zin.infolist():
                if item.filename == 'word/document.xml':
                    zout.writestr(item.filename, mixed_doc_xml.encode('utf-8'))
                else:
                    zout.writestr(item.filename, zin.read(item.filename))
            # Save chart as png to embed in docx
            diag_png_path = os.path.join(base_dir, 'mesh_diag.png')
            diag_img.save(diag_png_path)
            with open(diag_png_path, 'rb') as img_f:
                zout.writestr('word/media/image1.png', img_f.read())

    print(f"[OK] Generated: {out_mixed_docx}")

if __name__ == '__main__':
    generate_all()
