import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MatchesService } from './matches.service';
import { MatchesController } from './matches.controller';
import { CompatibilityService } from './compatibility.service';
import { AiService } from './ai.service';
import { Match, MatchSchema } from './schemas/match.schema';
import { CompatibilityInsight, CompatibilityInsightSchema } from './schemas/compatibility-insight.schema';
import { VectorService } from './vector.service';
import { ConfigModule } from '@nestjs/config';
import { ProfilesModule } from '../profiles/profiles.module';
import { QuestionnaireModule } from '../questionnaire/questionnaire.module';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Match.name, schema: MatchSchema },
      { name: CompatibilityInsight.name, schema: CompatibilityInsightSchema },
    ]),
    ConfigModule,
    HttpModule,
    ProfilesModule,
    QuestionnaireModule,
  ],
  controllers: [MatchesController],
  providers: [
    MatchesService,
    CompatibilityService,
    AiService,
    VectorService,
  ],
  exports: [
    MatchesService,
    CompatibilityService,
    AiService,
    VectorService,
  ],
})
export class AiMatchingModule {}
