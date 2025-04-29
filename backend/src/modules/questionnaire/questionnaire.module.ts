import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { QuestionnaireController } from './questionnaire.controller';
import { QuestionnaireService } from './questionnaire.service';
import { Questionnaire, QuestionnaireSchema } from './schemas/questionnaire.schema';
import { Question, QuestionSchema } from './schemas/question.schema';
import { Response, ResponseSchema } from './schemas/response.schema';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: Questionnaire.name, schema: QuestionnaireSchema },
      { name: Question.name, schema: QuestionSchema },
      { name: Response.name, schema: ResponseSchema },
    ]),
  ],
  controllers: [QuestionnaireController],
  providers: [QuestionnaireService],
  exports: [QuestionnaireService],
})
export class QuestionnaireModule {}
