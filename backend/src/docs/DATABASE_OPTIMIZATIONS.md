# Database Optimizations for Perfect Match

This document outlines the database optimization strategies implemented in the Perfect Match backend application to ensure optimal performance, scalability, and response times.

## Performance Metrics & Targets

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Query Execution Time | < 100ms (95th percentile) | MongoDB Query Profiler |
| Index Hit Ratio | > 99% | MongoDB Stats |
| Database CPU Usage | < 60% under peak load | AWS CloudWatch |
| Database Memory Usage | < 70% of allocated | AWS CloudWatch |
| Connection Pool Utilization | < 80% | Custom monitoring |
| Read Operations Latency | < 20ms | MongoDB Atlas Metrics |
| Write Operations Latency | < 50ms | MongoDB Atlas Metrics |
| Database Throughput | > 1000 ops/sec | Load testing |
| Replication Lag | < 10ms | MongoDB Atlas Metrics |

## Database Schema Optimizations

### Implemented Indexes

The following indexes have been added to optimize query performance:

#### Profile Collection
```javascript
// profiles.schema.ts
@Schema({ timestamps: true, collection: 'profiles' })
export class Profile {
  @Prop({ index: true })
  userId: string;

  @Prop({ index: 'text' })
  bio: string;

  @Prop({ index: true })
  gender: string;

  @Prop({ index: true })
  ageRange: { min: number; max: number };

  @Prop({ index: true })
  location: { type: string; coordinates: [number, number] };
  
  // Create a compound index for matching queries
  // @index({ gender: 1, "preferences.gender": 1, "ageRange.min": 1, "ageRange.max": 1 })
  
  // Create a geospatial index
  // @index({ location: "2dsphere" })
}
```

#### Match Collection
```javascript
// match.schema.ts
@Schema({ timestamps: true, collection: 'matches' })
export class Match {
  @Prop({ index: true })
  user1Id: string;

  @Prop({ index: true })
  user2Id: string;

  @Prop()
  compatibilityScore: number;

  @Prop({ index: true })
  status: string;
  
  // Compound index for user matching queries
  // @index({ user1Id: 1, status: 1 })
  // @index({ user2Id: 1, status: 1 })
  // @index({ user1Id: 1, user2Id: 1 }, { unique: true })
}
```

#### Conversation Collection
```javascript
// conversation.schema.ts
@Schema({ timestamps: true, collection: 'conversations' })
export class Conversation {
  @Prop({ index: true })
  participants: string[];
  
  @Prop({ index: true })
  lastMessageAt: Date;
  
  // Optimize for conversation listing and sorting
  // @index({ participants: 1, lastMessageAt: -1 })
}
```

#### Message Collection
```javascript
// message.schema.ts
@Schema({ timestamps: true, collection: 'messages' })
export class Message {
  @Prop({ index: true })
  conversationId: string;
  
  @Prop({ index: true })
  senderId: string;
  
  @Prop({ index: true })
  createdAt: Date;
  
  // Compound index for conversation message queries with pagination
  // @index({ conversationId: 1, createdAt: -1 })
}
```

#### Questionnaire Collection
```javascript
// questionnaire.schema.ts
@Schema({ timestamps: true, collection: 'questionnaires' })
export class Questionnaire {
  @Prop({ index: true })
  title: string;
  
  @Prop({ index: true })
  category: string;
  
  @Prop({ index: true })
  active: boolean;
  
  // Compound index for active questionnaire lookup
  // @index({ active: 1, category: 1 })
}
```

### Field Optimization

1. **Strategic Field Selection** 
   - Minimized embedded document depths (max 2 levels)
   - Limited array sizes for better query performance
   - Used appropriate data types for each field

2. **Normalization vs. Denormalization Decisions**
   - Denormalized user profile data in matches for faster retrieval
   - Normalized message content to optimize for volume
   - Hybrid approach for user profiles with frequently accessed fields duplicated in related collections

## Query Optimization Techniques

### Projection Implementation

All service methods implement projection to limit returned fields:

```typescript
// Example from profiles.service.ts
async findAllProfiles(
  filter: FilterQuery<Profile> = {},
  options: { limit?: number; offset?: number; fields?: string[] } = {}
): Promise<Profile[]> {
  const { limit = 20, offset = 0, fields } = options;
  
  // Create projection object from fields array
  const projection = fields?.reduce((acc, field) => {
    acc[field] = 1;
    return acc;
  }, {}) || {};
  
  return this.profileModel
    .find(filter)
    .select(projection)
    .skip(offset)
    .limit(limit)
    .lean()
    .exec();
}
```

### Pagination Implementation

All list endpoints implement cursor-based pagination:

```typescript
// Example from matches.controller.ts
@Get()
async findAll(
  @Req() req,
  @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  @Query('cursor') cursor?: string,
  @Query('fields') fields?: string,
): Promise<PaginatedResponse<Match>> {
  const userId = req.user.id;
  
  // Parse cursor from base64 if provided
  const decodedCursor = cursor ? JSON.parse(Buffer.from(cursor, 'base64').toString()) : null;
  
  // Build query with cursor-based pagination
  const query = { user1Id: userId };
  if (decodedCursor) {
    query['_id'] = { $gt: decodedCursor.lastId };
  }
  
  // Convert comma-separated fields to array
  const fieldArray = fields?.split(',') || [];
  
  const matches = await this.matchesService.findAll(
    query,
    { 
      limit: limit + 1, // Get one extra to determine if there are more results
      fields: fieldArray,
    }
  );
  
  // Check if there are more results
  const hasMore = matches.length > limit;
  if (hasMore) {
    matches.pop(); // Remove the extra item
  }
  
  // Create cursor for next page
  const nextCursor = hasMore 
    ? Buffer.from(JSON.stringify({ lastId: matches[matches.length - 1]._id })).toString('base64')
    : null;
  
  return {
    data: matches,
    pagination: {
      hasMore,
      nextCursor,
    }
  };
}
```

### Query Batching

Implemented batch operations for related data retrieval:

```typescript
// Example from a service method that batches multiple operations
async getMatchesWithProfiles(userId: string): Promise<MatchWithProfile[]> {
  // First get all matches
  const matches = await this.matchModel.find({ 
    $or: [{ user1Id: userId }, { user2Id: userId }],
    status: 'active'
  }).lean().exec();
  
  if (matches.length === 0) {
    return [];
  }
  
  // Extract all other user IDs for a single batch query
  const otherUserIds = matches.map(match => 
    match.user1Id === userId ? match.user2Id : match.user1Id
  );
  
  // Batch fetch all profiles in a single query
  const profiles = await this.profileModel.find({
    userId: { $in: otherUserIds }
  }).lean().exec();
  
  // Create a map for quick lookup
  const profileMap = profiles.reduce((acc, profile) => {
    acc[profile.userId] = profile;
    return acc;
  }, {});
  
  // Combine matches with profiles
  return matches.map(match => {
    const otherUserId = match.user1Id === userId ? match.user2Id : match.user1Id;
    return {
      ...match,
      profile: profileMap[otherUserId] || null
    };
  });
}
```

## Caching Implementation

### Redis Caching Layer

A Redis caching layer has been implemented for frequently accessed data:

```typescript
// Example cache implementation for profiles
@Injectable()
export class ProfileCacheService {
  private readonly ttl = 3600; // 1 hour cache

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private configService: ConfigService,
  ) {}

  // Generate cache key
  private getCacheKey(userId: string): string {
    return `profile:${userId}`;
  }

  // Get profile from cache
  async getProfile(userId: string): Promise<Profile | null> {
    const key = this.getCacheKey(userId);
    return await this.cacheManager.get<Profile>(key);
  }

  // Set profile in cache
  async setProfile(userId: string, profile: Profile): Promise<void> {
    const key = this.getCacheKey(userId);
    await this.cacheManager.set(key, profile, this.ttl);
  }

  // Invalidate profile cache
  async invalidateProfile(userId: string): Promise<void> {
    const key = this.getCacheKey(userId);
    await this.cacheManager.del(key);
  }
}
```

### Caching Strategy Implementation

1. **Cache Warm-Up**
   - Popular profiles are pre-loaded into cache on app startup
   - Questionnaire templates are cached at application initialization

2. **Cache Invalidation**
   - Time-based expiration for relatively static data
   - Event-based invalidation for frequently updated data
   - Targeted invalidation to minimize cache churn

3. **Selective Caching**
   - Only cache data with high read-to-write ratio
   - Implement tiered caching based on access frequency

## Database Connection Pooling

Connection pool optimized for application workload:

```typescript
// Example from app.module.ts
@Module({
  imports: [
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI'),
        useNewUrlParser: true,
        useUnifiedTopology: true,
        // Connection pool configuration
        connectionFactory: (connection) => {
          connection.on('connected', () => {
            console.log('DB connected');
          });
          connection.on('error', (error) => {
            console.error('DB connection error:', error);
          });
          return connection;
        },
        // Optimizing connection pool size based on workload
        poolSize: 10, // Adjust based on workload
        // Enable socket timeout
        socketTimeoutMS: 45000,
        // Enable serverSelectionTimeout
        serverSelectionTimeoutMS: 5000,
        // Enable connection timeout
        connectTimeoutMS: 10000,
      }),
    }),
    // Other imports
  ],
})
export class AppModule {}
```

## Write Operation Optimization

### Bulk Operations

Implemented bulk operations for batch data processing:

```typescript
// Example of bulk write operations
async bulkUpdateMatches(operations: BulkUpdateOperation[]): Promise<void> {
  if (operations.length === 0) {
    return;
  }
  
  const bulkOps = operations.map(op => ({
    updateOne: {
      filter: { _id: op.id },
      update: { $set: op.data },
    }
  }));
  
  await this.matchModel.bulkWrite(bulkOps, { ordered: false });
}
```

### Optimistic Concurrency Control

Implemented version-based concurrency control:

```typescript
// Example of optimistic concurrency control
async updateProfileWithConcurrencyControl(
  userId: string,
  data: UpdateProfileDto,
  version: number
): Promise<Profile> {
  const result = await this.profileModel.findOneAndUpdate(
    {
      userId,
      __v: version
    },
    {
      $set: data,
      $inc: { __v: 1 }
    },
    { new: true }
  );
  
  if (!result) {
    throw new ConflictException('Profile has been modified. Please retry with latest version.');
  }
  
  return result;
}
```

## Database Monitoring Configuration

### Query Profiling

Automated query performance monitoring has been implemented:

```typescript
// Example of a database monitoring service
@Injectable()
export class DatabaseMonitoringService implements OnModuleInit {
  private readonly slowQueryThreshold = 100; // ms
  
  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly loggerService: LoggingService,
  ) {}
  
  async onModuleInit() {
    if (process.env.NODE_ENV !== 'production') {
      // Enable database profiling in development
      const db = this.connection.db;
      await db.command({ profile: 2, slowms: this.slowQueryThreshold });
      
      // Set up periodic collection of slow queries
      setInterval(async () => {
        const slowQueries = await db.collection('system.profile').find({}).toArray();
        
        if (slowQueries.length > 0) {
          this.loggerService.warn('Detected slow database queries', {
            count: slowQueries.length,
            queries: slowQueries.map(q => ({
              ns: q.ns,
              op: q.op,
              millis: q.millis,
              query: q.query,
            }))
          });
        }
      }, 5 * 60 * 1000); // Check every 5 minutes
    }
  }
}
```

## Load Testing Instructions

### Setup

1. Install load testing tools:
```bash
npm install -g artillery
```

2. Create the test scenario file (load-test.yml):
```yaml
config:
  target: "https://api.perfectmatch.example.com"
  phases:
    - duration: 60
      arrivalRate: 5
      rampTo: 50
      name: "Warm up phase"
    - duration: 300
      arrivalRate: 50
      name: "Sustained load"
    - duration: 60
      arrivalRate: 50
      rampTo: 100
      name: "Peak load"
  plugins:
    metrics-by-endpoint: {}
  http:
    timeout: 10
    
scenarios:
  - name: "User browsing matches"
    flow:
      - post:
          url: "/auth/login"
          json:
            email: "{{ $randomString(10) }}@example.com"
            password: "password123"
          capture:
            - json: "$.token"
              as: "token"
      
      - get:
          url: "/matches?limit=20"
          headers:
            Authorization: "Bearer {{ token }}"
          capture:
            - json: "$.pagination.nextCursor"
              as: "cursor"
            - json: "$.data[0].matchId"
              as: "matchId"
      
      - get:
          url: "/matches?limit=20&cursor={{ cursor }}"
          headers:
            Authorization: "Bearer {{ token }}"
      
      - get:
          url: "/matches/{{ matchId }}"
          headers:
            Authorization: "Bearer {{ token }}"
```

3. Create database-focused test (db-load-test.yml):
```yaml
config:
  target: "https://api.perfectmatch.example.com"
  phases:
    - duration: 300
      arrivalRate: 20
      name: "Database Query Test"
  plugins:
    expect: {}
  http:
    timeout: 10
    
scenarios:
  - name: "Complex Query Test"
    flow:
      - post:
          url: "/auth/login"
          json:
            email: "{{ $randomString(10) }}@example.com"
            password: "password123"
          capture:
            - json: "$.token"
              as: "token"
      
      - get:
          url: "/profiles/search?distance=10&gender=female&minAge=25&maxAge=35&interests=travel,music&limit=20"
          headers:
            Authorization: "Bearer {{ token }}"
          expect:
            - statusCode: 200
            - contentType: "application/json"
            - responseTime: 200
```

### Running Tests

Execute the load tests with:

```bash
# General load test
artillery run load-test.yml --output report.json

# Database-focused test
artillery run db-load-test.yml --output db-report.json

# Generate HTML reports
artillery report report.json
artillery report db-report.json
```

### Performance Monitoring During Tests

1. Enable MongoDB profiling during tests:
```bash
# Connect to MongoDB shell
mongo <connection_uri>

# Enable profiling
db.setProfilingLevel(2, { slowms: 100 })

# After test, view slow queries
db.system.profile.find().sort({ts:-1}).limit(10).pretty()
```

2. Monitor system metrics:
```bash
# Monitor system resources during test
htop

# Monitor network connections
netstat -anp | grep node
```

### Acceptance Criteria

For database performance approval, the system must meet all of the following criteria:

- All database queries complete in < 100ms (95th percentile)
- Index hit ratio > 99%
- No table scans on collections with more than 1000 documents
- Write operations complete in < 200ms
- System maintains performance with 10x simulated data volume
- Connection pool utilization remains < 80% at peak load
- Cache hit ratio > 90% for configured cacheable resources

## Environment-Specific Configurations

### Development

```typescript
// Development database configuration
@Module({
  imports: [
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI'),
        useNewUrlParser: true,
        useUnifiedTopology: true,
        // Development-specific settings
        debug: true,
        poolSize: 5,
      }),
    }),
  ],
})
export class AppModule {}
```

### Production

```typescript
// Production database configuration
@Module({
  imports: [
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI'),
        useNewUrlParser: true,
        useUnifiedTopology: true,
        // Production-specific settings
        poolSize: 20,
        socketTimeoutMS: 45000,
        keepAlive: true,
        keepAliveInitialDelay: 300000,
        // Disable debug
        debug: false,
        // Read preference for replicas
        readPreference: 'secondaryPreferred',
      }),
    }),
  ],
})
export class AppModule {}
```

## Future Optimizations

1. Implement database sharding for horizontal scaling
2. Add read replicas with appropriate read preferences
3. Implement time-series collections for analytics data
4. Explore partial indexes for collections exceeding 10GB
5. Implement compound indexes based on query patterns discovered in production
6. Consider moving to MongoDB Atlas Search for text search capabilities
7. Implement database schema validation on all collections
