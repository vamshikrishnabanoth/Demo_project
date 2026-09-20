import os
import zipfile
from PIL import Image, ImageDraw, ImageFont

def build_assets():
    test_dir = os.path.dirname(__file__)
    os.makedirs(test_dir, exist_ok=True)

    # Helper: draw centered text
    def draw_text(d, pos, text, fill=(0, 0, 0)):
        d.text(pos, text, fill=fill)

    # ──────────────────────────────────────────────────────────────────────────
    # 1. Create pdf_chart_sales.pdf (Real PDF containing sales trend chart)
    # ──────────────────────────────────────────────────────────────────────────
    chart_img = Image.new('RGB', (1000, 700), color=(255, 255, 255))
    d = ImageDraw.Draw(chart_img)
    
    # Title
    draw_text(d, (50, 40), "Annual Sales Revenue Performance Report", fill=(20, 20, 20))
    draw_text(d, (50, 70), "Company Financial Operations & Trend Analysis (2021 - 2024)", fill=(80, 80, 80))

    # Chart Box
    origin_x = 150
    origin_y = 520
    axis_width = 750
    axis_height = 380

    # Draw Axes
    d.line([(origin_x, origin_y), (origin_x + axis_width, origin_y)], fill=(50, 50, 50), width=3) # X-axis
    d.line([(origin_x, origin_y), (origin_x, origin_y - axis_height)], fill=(50, 50, 50), width=3) # Y-axis

    # Y-axis labels and grid lines (0, 50, 100, 150, 200 million)
    y_ticks = [(0, 0), (50, 95), (100, 190), (150, 285), (200, 380)]
    for val, px in y_ticks:
        y_pos = origin_y - px
        d.line([(origin_x - 10, y_pos), (origin_x + axis_width, y_pos)], fill=(220, 220, 220), width=1)
        draw_text(d, (origin_x - 55, y_pos - 8), f"{val}M", fill=(50, 50, 50))
    draw_text(d, (60, origin_y - axis_height - 25), "Revenue (USD Millions)", fill=(30, 30, 30))

    # Bars: 2021 -> 100, 2022 -> 140, 2023 -> 180, 2024 -> 160
    data = [
        ("2021", 100, 190),
        ("2022", 140, 266),
        ("2023", 180, 342),
        ("2024", 160, 304),
    ]

    bar_width = 90
    spacing = 160
    for idx, (year, val, bar_h) in enumerate(data):
        bx = origin_x + 60 + (idx * spacing)
        by = origin_y - bar_h
        # Draw Bar
        d.rectangle([(bx, by), (bx + bar_width, origin_y)], fill=(41, 128, 185), outline=(21, 67, 96), width=2)
        # Value on top of bar
        draw_text(d, (bx + 15, by - 25), f"${val}M", fill=(10, 10, 10))
        # Year below X-axis
        draw_text(d, (bx + 20, origin_y + 15), year, fill=(20, 20, 20))

    draw_text(d, (origin_x + 300, origin_y + 50), "Calendar Year (X-Axis)", fill=(30, 30, 30))

    # Context commentary
    draw_text(d, (50, 600), "Key Observations:", fill=(20, 20, 20))
    draw_text(d, (50, 625), "• Peak revenue occurred in 2023 reaching $180M before adjusting to $160M in 2024.", fill=(40, 40, 40))
    draw_text(d, (50, 650), "• Total revenue expanded from $100M in 2021 to $140M in 2022, demonstrating a 40% growth rate.", fill=(40, 40, 40))

    chart_pdf_path = os.path.join(test_dir, 'pdf_chart_sales.pdf')
    chart_img.save(chart_pdf_path, 'PDF', resolution=100.0)
    print(f"[OK] Generated: {chart_pdf_path}")

    # Also save as PNG for DOCX embedding
    chart_png_path = os.path.join(test_dir, 'sales_chart.png')
    chart_img.save(chart_png_path, 'PNG')

    # ──────────────────────────────────────────────────────────────────────────
    # 2. Create pdf_diagram_architecture.pdf (System architecture diagram)
    # ──────────────────────────────────────────────────────────────────────────
    diag_img = Image.new('RGB', (1000, 850), color=(255, 255, 255))
    d = ImageDraw.Draw(diag_img)

    draw_text(d, (50, 30), "Enterprise Distributed Web Architecture", fill=(20, 20, 20))
    draw_text(d, (50, 60), "End-to-End Request Pipeline & Component Hierarchy", fill=(80, 80, 80))

    # Flow:
    # 1. Client Browser (y=120)
    # 2. API Gateway (y=250)
    # 3. Load Balancer (y=380)
    # 4. Application Server (y=510)
    # 5. Database Cluster (y=640)

    nodes = [
        ("Client Browser", "Initiates secure HTTPS requests over public network", 110, (235, 245, 251), (41, 128, 185)),
        ("API Gateway", "Performs TLS termination, authentication & rate limiting", 240, (234, 250, 241), (39, 174, 96)),
        ("Load Balancer", "Distributes traffic across server instances using round-robin", 370, (254, 249, 231), (241, 196, 15)),
        ("Application Server", "Executes business logic, microservices & controller routines", 500, (253, 237, 236), (231, 76, 60)),
        ("Database Cluster", "Stores ACID relational records with read-replicas & caching", 630, (244, 236, 247), (142, 68, 173)),
    ]

    for title, desc, y_pos, bg_color, border_color in nodes:
        # Draw Node Box
        d.rectangle([(200, y_pos), (800, y_pos + 80)], fill=bg_color, outline=border_color, width=3)
        draw_text(d, (230, y_pos + 15), f"Component: {title}", fill=(10, 10, 10))
        draw_text(d, (230, y_pos + 45), desc, fill=(60, 60, 60))

    # Draw Connecting Arrows between blocks
    arrow_positions = [(190, 240), (320, 370), (450, 500), (580, 630)]
    for y_start, y_end in arrow_positions:
        d.line([(500, y_start), (500, y_end)], fill=(50, 50, 50), width=4)
        # Arrowhead
        d.polygon([(490, y_end - 10), (510, y_end - 10), (500, y_end)], fill=(50, 50, 50))

    # Annotations
    draw_text(d, (520, 205), "1. Encrypted Request", fill=(41, 128, 185))
    draw_text(d, (520, 335), "2. Authenticated Traffic", fill=(39, 174, 96))
    draw_text(d, (520, 465), "3. Balanced Stream", fill=(211, 84, 0))
    draw_text(d, (520, 595), "4. Query Dispatch", fill=(142, 68, 173))

    draw_text(d, (50, 750), "Architecture Summary Note:", fill=(20, 20, 20))
    draw_text(d, (50, 775), "• The Load Balancer receives traffic from the API Gateway before routing to the Application Server.", fill=(40, 40, 40))
    draw_text(d, (50, 800), "• High availability is maintained by health checks conducted by the Load Balancer.", fill=(40, 40, 40))

    diag_pdf_path = os.path.join(test_dir, 'pdf_diagram_architecture.pdf')
    diag_img.save(diag_pdf_path, 'PDF', resolution=100.0)
    print(f"[OK] Generated: {diag_pdf_path}")

    diag_png_path = os.path.join(test_dir, 'architecture_diagram.png')
    diag_img.save(diag_png_path, 'PNG')

    # ──────────────────────────────────────────────────────────────────────────
    # 3. Create scanned_multipage.pdf (4-page multi-page scanned PDF)
    # ──────────────────────────────────────────────────────────────────────────
    # Page 1: Definition of Distributed Consensus
    p1 = Image.new('RGB', (900, 650), color=(255, 255, 255))
    d1 = ImageDraw.Draw(p1)
    draw_text(d1, (40, 40), "Chapter 7: Distributed Systems Consensus", fill=(0, 0, 0))
    draw_text(d1, (40, 80), "Distributed consensus ensures that multiple nodes agree on a state value.", fill=(20, 20, 20))
    draw_text(d1, (40, 120), "In asynchronous networks with crash failures, consensus is essential for state replication.", fill=(20, 20, 20))
    draw_text(d1, (40, 160), "The Raft consensus protocol achieves state machine replication via an elected leader.", fill=(20, 20, 20))
    draw_text(d1, (40, 200), "Raft decomposes consensus into leader election, log replication, and safety guarantees.", fill=(20, 20, 20))
    draw_text(d1, (40, 240), "Nodes in Raft exist in one of three states: Leader, Follower, or Candidate.", fill=(20, 20, 20))
    draw_text(d1, (40, 580), "[Document Provenance: Page 1 of 4 - Distributed Consensus Foundations]", fill=(100, 100, 100))

    # Page 2: Table of Consensus Protocols
    p2 = Image.new('RGB', (900, 650), color=(255, 255, 255))
    d2 = ImageDraw.Draw(p2)
    draw_text(d2, (40, 40), "Comparative Analysis of Consensus Protocols", fill=(0, 0, 0))
    draw_text(d2, (40, 80), "The following table details protocol complexities and guarantees:", fill=(20, 20, 20))
    
    # Table text representation
    t_lines = [
        "Protocol | Leader Model | Fault Tolerance | Understandability",
        "Raft | Strong Single Leader | Majority (N/2 + 1) | High",
        "Multi-Paxos | Weak/Multi Leader | Majority (N/2 + 1) | Low",
        "Zab (ZooKeeper) | Primary-Backup | Majority (N/2 + 1) | Moderate",
        "PBFT | View-Change Leader | (3f + 1) nodes | Complex"
    ]
    y_off = 130
    for l in t_lines:
        draw_text(d2, (40, y_off), l, fill=(0, 0, 0))
        y_off += 35

    draw_text(d2, (40, y_off + 40), "A Raft cluster of 5 nodes can continue operating properly despite 2 node failures.", fill=(30, 30, 30))
    draw_text(d2, (40, 580), "[Document Provenance: Page 2 of 4 - Protocol Comparison Table]", fill=(100, 100, 100))

    # Page 3: Diagram of Raft State Transitions
    p3 = Image.new('RGB', (900, 650), color=(255, 255, 255))
    d3 = ImageDraw.Draw(p3)
    draw_text(d3, (40, 40), "Raft Node State Machine Diagram", fill=(0, 0, 0))
    draw_text(d3, (40, 90), "[Follower State] --(election timeout)--> [Candidate State]", fill=(0, 0, 0))
    draw_text(d3, (40, 140), "[Candidate State] --(votes from majority)--> [Leader State]", fill=(0, 0, 0))
    draw_text(d3, (40, 190), "[Candidate State] --(discovers new leader)--> [Follower State]", fill=(0, 0, 0))
    draw_text(d3, (40, 240), "[Leader State] --(discovers term > currentTerm)--> [Follower State]", fill=(0, 0, 0))
    draw_text(d3, (40, 310), "Heartbeats: The Leader sends periodic AppendEntries RPCs with no log entries.", fill=(30, 30, 30))
    draw_text(d3, (40, 350), "If followers receive heartbeats before their randomized election timeout expires, they remain followers.", fill=(30, 30, 30))
    draw_text(d3, (40, 580), "[Document Provenance: Page 3 of 4 - State Machine Diagram]", fill=(100, 100, 100))

    # Page 4: Explanatory text
    p4 = Image.new('RGB', (900, 650), color=(255, 255, 255))
    d4 = ImageDraw.Draw(p4)
    draw_text(d4, (40, 40), "Byzantine Fault Tolerance and Network Partitions", fill=(0, 0, 0))
    draw_text(d4, (40, 80), "Crash fault tolerance assumes nodes fail by stopping, not by lying or sending corrupt packets.", fill=(20, 20, 20))
    draw_text(d4, (40, 120), "Raft and Paxos handle crash fault tolerance (CFT).", fill=(20, 20, 20))
    draw_text(d4, (40, 160), "During a network partition, only the partition containing a strict majority can commit entries.", fill=(20, 20, 20))
    draw_text(d4, (40, 200), "The minority partition cannot achieve quorum and rejects write requests.", fill=(20, 20, 20))
    draw_text(d4, (40, 580), "[Document Provenance: Page 4 of 4 - Fault Tolerance and Partitions]", fill=(100, 100, 100))

    multi_pdf_path = os.path.join(test_dir, 'scanned_multipage.pdf')
    p1.save(multi_pdf_path, 'PDF', save_all=True, append_images=[p2, p3, p4], resolution=100.0)
    print(f"[OK] Generated: {multi_pdf_path}")

    # ──────────────────────────────────────────────────────────────────────────
    # 4. Create docx_mixed_content.docx
    # ──────────────────────────────────────────────────────────────────────────
    base_docx = os.path.join(os.path.dirname(__file__), '..', 'node_modules', 'mammoth', 'test', 'test-data', 'tables.docx')
    out_mixed_docx = os.path.join(test_dir, 'docx_mixed_content.docx')

    mixed_doc_xml = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
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
            # Add embedded image to word/media/
            with open(diag_png_path, 'rb') as img_f:
                zout.writestr('word/media/image1.png', img_f.read())

    print(f"[OK] Generated: {out_mixed_docx}")

if __name__ == '__main__':
    build_assets()
