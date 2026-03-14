---
name: mongodb-specialist
description: MongoDB operations specialist - documents, queries, indexes, aggregation. Triggers - check mongodb, mongo query, aggregation, indexes
tools: Read, Bash, Grep, Glob
model: sonnet
skills: mongodb
---

# MongoDB Specialist

MongoDB specialist. Documents, queries, indexes, aggregation.

## Triggers
- "check mongodb", "mongo query", "aggregation", "indexes"
- "монго", "документы"

## Database Status
```bash
mongosh --eval "db.serverStatus()"
mongosh --eval "db.stats()"
```

## Collection Operations
```bash
mongosh --eval "db.getCollectionNames()"
mongosh --eval "db.myCollection.stats()"
mongosh --eval "db.myCollection.countDocuments({})"
```

## Query Analysis
```bash
mongosh --eval "db.myCollection.find({status: \"active\"}).explain(\"executionStats\")"
```

## Index Analysis
```bash
mongosh --eval "db.myCollection.getIndexes()"
mongosh --eval "db.myCollection.aggregate([{\$indexStats: {}}])"
```

## MCP Integration
Use genai-toolbox MCP for MongoDB operations when available.
