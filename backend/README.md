L# oad Layer

- **Load Layer Overview**
  - Functions in close integration with the **Transform Layer**.
  - Primary objective: Ingest source data and utilize AI/automated tools to convert it into a **manageable format**.
- **Data Ingestion & Processing Methods**
  - **Standard Parsing:** Utilizing tools like `BeautifulSoup` to extract raw text from unstructured sources.
  - **Integrated Load & Transform:** Merging the two layers into a single workflow for higher efficiency.
  - **AI-Driven Extraction:** Implementing advanced tools (e.g., xAI) to perform targeted searches, retrieve specific information, and automatically structure it into a high-quality format.
- **Key Benefits**
  - Reduces manual data cleaning by automating the transition from raw source to structured output.
  - Enables the pipeline to handle diverse data types through intelligent searching and formatting.

# Transform Layer

- **The Load Layer**
  - Deeply connected to the transform step—basically the "hand-off" point.
  - Takes any source data and uses AI to clean it up into something manageable.
  - **Tools:** Can be simple (BeautifulSoup for raw text) or advanced (xAI to search, grab, and format everything at once).
- **The Transform Layer**
  - Takes that loaded info and shapes it into the final database schema.
  - **The Package:** It organizes the title, short/long descriptions, links, and images.
  - **Workflow:** If the load layer was rudimentary, this layer uses AI to "up-level" the data. If the load layer used xAI, this step is just a final polish.
  - **Logic:** It’s a straight shot—data moves from Load to Transform without circling back.
- **The AI Factor**
  - While you _could_ do this with hard-coded rules, using AI is the way to go since sources are usually too messy to handle manually.

# Embed Layer

- **Final Step in the Chain**
  - This is the last stop for the data before it hits the storage layer.
  - Since the logic is basically done, it's just a matter of execution.
- **Model Specs**
  - Uses a **384-dimension vector model** to process the transformed data.
  - Converts the structured text (titles, summaries, etc.) into embeddings that the database can actually understand.
- **Storage Handoff**
  - Once the vectors are generated, they are sent directly to the **Vector AI database** (the storage layer) for final saving.

# Store Layer

- **The Setup: Actian VectorAI DB**
  - We're using **Actian VectorAI DB** as our high-performance storage layer.
  - This is our "Source of Truth"—it holds all up-to-date, transformed, and embedded data.
- **Deployment Strategy**
  - **Hosting:** Ideally hosted in a public cloud environment like **AWS** (using EC2, ECS, or EKS).
  - **Method:** We'll use **Docker** for deployment
- **Data Flow**
  - It’s the final destination. Once data passes the Embed Layer, it’s pushed directly into Actian.
  - Because it handles high-dimensional vectors and standard relational data, it keeps everything together in one place.

# Offline Store Layer

- **Mobile-First Constraints**
  - Since the **Actian VectorAI DB** can’t run directly on a phone, we need a "lite" version for local use.
  - **The Goal:** A fast, low-footprint offline mode that gives the user immediate value without needing a signal.
- **The "Conversion" Process**
  - We'll run a function that strips the "full" database down to its essentials.
  - **Data Kept:** Title, 384-vector embedding, and short "tips" or snippets of the content.
  - **Data Dropped:** Full text and links (since they won't work offline anyway).
- **The Two-Database Strategy (Online)**
  - To avoid making the phone do heavy lifting, we’ll host two versions on **AWS**:
    1. **Main Vector DB:** The full Actian source of truth.
    2. **JSON/NoSQL Mirror:** A pre-converted version of the data stored as a simple JSON object or in a NoSQL store (like DynamoDB).
  - **Benefit:** The phone just downloads the lightweight file/data directly. We only convert the data once on the server side, not every time a user syncs.
- **Offline UX**
  - The phone stores this JSON/NoSQL locally.
  - Users can still search and see key tips/titles instantly, even in the middle of nowhere.

# Retrieval Layer

- **Hybrid Search Strategy**
  - Combines internal data with live internet access for the most up-to-date and "fluid" responses.
  - Moves beyond simple search results to a more conversational, unstructured format.
- **The Retrieval Process (RAG)**
  - **Step 1: Embedding:** The user’s request is converted into a vector using the 384-model.
  - **Step 2: Actian Query:** The system searches the **Actian VectorAI** database to pull the top 3–5 most relevant pieces of information.
  - **Step 3: LLM Synthesis:** These results are fed into an LLM (the "Brain").
- **Personalization & Output**
  - The LLM aggregates the retrieved data and tailors the final response to the user's specific context.
  - This allows the system to answer complex "why" or "how-to" questions rather than just showing a list of links.
