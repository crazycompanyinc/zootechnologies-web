# 🧠 AI Agent Memory Toolkit — Complete Guide

## The Problem: Your AI Agent Forgets Everything

Every time you start a new conversation with your AI agent, it's like hiring a new employee with amnesia. They don't remember:
- Previous decisions and context
- User preferences and history
- Project state and progress
- Learned patterns from past interactions

This isn't just annoying — it's **costing you money**. Wasted tokens, repetitive explanations, and agents that can't learn from mistakes.

## The Solution: Production-Ready Memory Architecture

This toolkit gives you everything you need to give your AI agents **persistent, intelligent memory** that actually works in production.

## What's Inside

### 1. Vector Memory Store (ChromaDB)
```python
import chromadb
from chromadb.utils import embedding_functions

# Initialize persistent memory
client = chromadb.PersistentClient(path="./agent_memory")
ef = embedding_functions.DefaultEmbeddingFunction()

# Create collection for agent memories
collection = client.get_or_create_collection(
    name="agent_memories",
    embedding_function=ef,
    metadata={"hnsw:space": "cosine"}
)

def remember(content: str, metadata: dict = None):
    """Store a memory with automatic embedding."""
    collection.add(
        documents=[content],
        metadatas=[metadata or {}],
        ids=[f"mem_{collection.count() + 1}"]
    )

def recall(query: str, n_results: int = 5) -> list:
    """Retrieve relevant memories for a given context."""
    results = collection.query(
        query_texts=[query],
        n_results=n_results
    )
    return [
        {"content": doc, "score": 1 - dist}
        for doc, dist in zip(
            results['documents'][0],
            results['distances'][0]
        )
    ]

def forget(memory_id: str):
    """Explicitly remove a memory."""
    collection.delete(ids=[memory_id])
```

### 2. Hierarchical Memory System
```python
from dataclasses import dataclass, field
from typing import Optional
from datetime import datetime, timedelta
import json

@dataclass
class Memory:
    content: str
    importance: float = 0.5  # 0-1
    created_at: datetime = field(default_factory=datetime.now)
    last_accessed: Optional[datetime] = None
    access_count: int = 0
    tags: list = field(default_factory=list)

@dataclass
class WorkingMemory:
    """Short-term: Current session context."""
    max_items: int = 20
    items: list = field(default_factory=list)
    
    def add(self, content: str, importance: float = 0.5):
        self.items.append(Memory(content=content, importance=importance))
        if len(self.items) > self.max_items:
            # Remove least important + oldest
            self.items.sort(key=lambda m: m.importance)
            self.items.pop(0)
    
    def get_context(self, max_tokens: int = 2000) -> str:
        """Format memories as context string for LLM."""
        sorted_items = sorted(self.items, key=lambda m: m.importance, reverse=True)
        context = []
        for mem in sorted_items:
            context.append(f"[{mem.importance:.1f}] {mem.content}")
            mem.last_accessed = datetime.now()
            mem.access_count += 1
        return "\n".join(context)

@dataclass
class EpisodicMemory:
    """Medium-term: Past conversations and events."""
    memories: list = field(default_factory=list)
    
    def add_episode(self, summary: str, emotions: list = None, outcome: str = ""):
        self.memories.append({
            "summary": summary,
            "emotions": emotions or [],
            "outcome": outcome,
            "timestamp": datetime.now().isoformat()
        })
    
    def get_relevant_episodes(self, context: str, n: int = 3) -> list:
        # Simple keyword matching (replace with vector search in production)
        scored = []
        for ep in self.memories:
            score = sum(1 for word in context.lower().split() 
                       if word in ep["summary"].lower())
            scored.append((score, ep))
        scored.sort(key=lambda x: x[0], reverse=True)
        return [ep for _, ep in scored[:n]]

@dataclass
class SemanticMemory:
    """Long-term: Facts, preferences, knowledge base."""
    facts: dict = field(default_factory=dict)
    preferences: dict = field(default_factory=dict)
    
    def add_fact(self, subject: str, fact: str, confidence: float = 1.0):
        if subject not in self.facts:
            self.facts[subject] = []
        self.facts[subject].append({"fact": fact, "confidence": confidence})
    
    def add_preference(self, category: str, preference: str, strength: float = 0.8):
        self.preferences[category] = {"value": preference, "strength": strength}
    
    def get_facts_about(self, subject: str) -> list:
        return self.facts.get(subject, [])
    
    def get_all_preferences(self) -> dict:
        return self.preferences

class HierarchicalMemorySystem:
    """Combines all three memory types."""
    
    def __init__(self):
        self.working = WorkingMemory()
        self.episodic = EpisodicMemory()
        self.semantic = SemanticMemory()
    
    def perceive(self, content: str, importance: float = 0.5):
        """Process new information into appropriate memory layer."""
        self.working.add(content, importance)
        
        if importance > 0.7:
            self.semantic.add_fact("general", content, confidence=importance)
    
    def reflect(self):
        """Move important working memory to episodic."""
        important = [m for m in self.working.items if m.access_count > 2]
        for mem in important:
            self.episodic.add_episode(
                summary=mem.content,
                outcome="remembered"
            )
    
    def build_context(self, query: str) -> str:
        """Build rich context from all memory layers."""
        ctx_parts = []
        
        # Layer 1: Working memory (immediate context)
        working_ctx = self.working.get_context()
        if working_ctx:
            ctx_parts.append(f"## Current Session:\n{working_ctx}")
        
        # Layer 2: Relevant episodes
        episodes = self.episodic.get_relevant_episodes(query)
        if episodes:
            ctx_parts.append(f"## Relevant Past Events:\n" + 
                           "\n".join(f"- {e['summary']}" for e in episodes))
        
        # Layer 3: Known facts
        facts = self.semantic.get_facts_about(query)
        if facts:
            ctx_parts.append(f"## Known Facts:\n" +
                           "\n".join(f"- {f['fact']} (conf: {f['confidence']})" for f in facts))
        
        return "\n\n".join(ctx_parts)
```

### 3. Memory Consolidation & Forgetting
```python
class MemoryConsolidator:
    """Periodically consolidate and prune memories."""
    
    def __init__(self, memory_system: HierarchicalMemorySystem):
        self.ms = memory_system
    
    def consolidate(self):
        """Move important working memories to long-term storage."""
        self.ms.reflect()
        
        # Promote frequently accessed semantic memories
        # Demote unused ones
        stale = []
        for subject, facts in self.ms.semantic.facts.items():
            for fact in facts:
                if fact["confidence"] < 0.3:
                    stale.append((subject, fact))
        
        for subject, fact in stale:
            self.ms.semantic.facts[subject].remove(fact)
    
    def get_stats(self) -> dict:
        return {
            "working_memories": len(self.ms.working.items),
            "episodic_memories": len(self.ms.episodic.memories),
            "semantic_facts": sum(len(f) for f in self.ms.semantic.facts.values()),
            "preferences": len(self.ms.semantic.preferences)
        }
```

### 4. Multi-Agent Memory Sharing
```python
import redis
import json
from typing import Optional

class SharedMemoryStore:
    """Share memory between multiple agents using Redis."""
    
    def __init__(self, redis_url: str = "redis://localhost:6379"):
        self.redis = redis.from_url(redis_url)
        self.namespace = "zoo:memory"
    
    def share(self, agent_id: str, key: str, value: str, ttl: int = 86400):
        """Share a memory across agents."""
        full_key = f"{self.namespace}:{agent_id}:{key}"
        self.redis.setex(full_key, ttl, value)
    
    def get_shared(self, agent_id: str, key: str) -> Optional[str]:
        """Retrieve a shared memory."""
        full_key = f"{self.namespace}:{agent_id}:{key}"
        value = self.redis.get(full_key)
        return value.decode() if value else None
    
    def broadcast(self, from_agent: str, event: str, data: dict):
        """Broadcast an event to all agents."""
        message = json.dumps({
            "from": from_agent,
            "event": event,
            "data": data,
            "timestamp": datetime.now().isoformat()
        })
        self.redis.publish(f"{self.namespace}:events", message)
    
    def search_all_agents(self, query: str) -> dict:
        """Search memories across all agents."""
        results = {}
        for key in self.redis.scan_iter(f"{self.namespace}:*:{query}*"):
            agent = key.decode().split(":")[2]
            value = self.redis.get(key)
            if agent not in results:
                results[agent] = []
            results[agent].append(value.decode())
        return results
```

### 5. Production Integration Example
```python
from openai import OpenAI

class AgentWithMemory:
    """Complete agent with hierarchical memory."""
    
    def __init__(self, name: str, system_prompt: str):
        self.name = name
        self.client = OpenAI()
        self.memory = HierarchicalMemorySystem()
        self.system_prompt = system_prompt
    
    def chat(self, user_message: str) -> str:
        # Build rich context from memory
        context = self.memory.build_context(user_message)
        
        messages = [
            {"role": "system", "content": self.system_prompt},
        ]
        
        if context:
            messages.append({
                "role": "system", 
                "content": f"## Memory Context:\n{context}"
            })
        
        messages.append({"role": "user", "content": user_message})
        
        response = self.client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            temperature=0.7
        )
        
        reply = response.choices[0].message.content
        
        # Store interaction in memory
        self.memory.perceive(
            f"User said: {user_message}\nAgent replied: {reply[:200]}",
            importance=0.6
        )
        
        return reply
    
    def remember_fact(self, fact: str):
        """Explicitly store a fact."""
        self.memory.semantic.add_fact(
            subject="user_provided",
            fact=fact,
            confidence=0.9
        )
    
    def get_memory_stats(self) -> dict:
        return {
            "facts": sum(len(f) for f in self.memory.semantic.facts.values()),
            "episodes": len(self.memory.episodic.memories),
            "working": len(self.memory.working.items),
            "preferences": len(self.memory.semantic.preferences)
        }
```

## Architecture Diagram

```
┌─────────────────────────────────────────────┐
│              User Input                       │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│         Working Memory (Short-term)          │
│  - Current session context                   │
│  - Last 20 exchanges                         │
│  - Auto-eviction by importance               │
└─────────────────┬───────────────────────────┘
                  │ (consolidation)
                  ▼
┌─────────────────────────────────────────────┐
│        Episodic Memory (Medium-term)         │
│  - Past conversation summaries               │
│  - Emotional context + outcomes              │
│  - Relevance-ranked retrieval                │
└─────────────────┬───────────────────────────┘
                  │ (reflection)
                  ▼
┌─────────────────────────────────────────────┐
│        Semantic Memory (Long-term)            │
│  - User preferences                          │
│  - Facts & knowledge base                    │
│  - Confidence-scored retrieval               │
└─────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│         Vector Store (ChromaDB)               │
│  - Semantic search over all memories         │
│  - Cosine similarity ranking                 │
│  - Persistent on disk                        │
└─────────────────────────────────────────────┘
```

## Quick Start

1. **Install dependencies:**
```bash
pip install chromadb openai redis
```

2. **Copy the code above into your project**

3. **Initialize memory:**
```python
agent = AgentWithMemory(
    name="ZooAgent",
    system_prompt="You are a helpful AI assistant with persistent memory."
)
```

4. **Chat with memory:**
```python
response = agent.chat("Remember that I prefer TypeScript over JavaScript")
response = agent.chat("What programming language do I prefer?")
# Agent will recall the preference!
```

## License

MIT License — Personal and commercial use permitted.

---

**Created by ZOO Technologies** | zootechnologies.com
