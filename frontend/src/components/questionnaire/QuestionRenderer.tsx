import React, { useId, useEffect } from 'react';
import {
  Typography,
  FormControl,
  FormControlLabel,
  FormHelperText,
  Radio,
  RadioGroup,
  Checkbox,
  TextField,
  Slider,
  Box,
  Rating,
  ToggleButton,
  ToggleButtonGroup,
  Stack,
  Chip,
  Divider,
  InputLabel
} from '@mui/material';
import { Question, QuestionOption } from '@/lib/questionnaire/questionnaireApi';
import { QuestionType } from '@/lib/questionnaire/enums';
import { announceToScreenReader } from '@/utils/accessibility';

interface QuestionRendererProps {
  question: Question;
  value: any;
  onChange: (value: any) => void;
  disabled?: boolean;
  error?: string;
}

const QuestionRenderer: React.FC<QuestionRendererProps> = ({
  question,
  value,
  onChange,
  disabled = false,
  error
}) => {
  // Generate unique IDs for accessibility
  const uniqueId = useId();
  const questionId = `question-${question.id || uniqueId}`;
  const errorId = `${questionId}-error`;
  const descriptionId = `${questionId}-description`;

  // Determine if the question is answered with a valid value
  const isAnswered = value !== undefined && value !== null && value !== '' &&
    !(Array.isArray(value) && value.length === 0);

  // Extract validation props
  const { validations } = question;

  // Announce validation errors to screen readers
  useEffect(() => {
    if (error) {
      announceToScreenReader(`Error: ${error}`, true);
    }
  }, [error]);

  const renderQuestionText = () => (
    <Box sx={{ mb: 2 }}>
      <Typography
        variant="h6"
        component="h3"
        id={questionId}
        sx={{ fontWeight: question.isRequired ? 'bold' : 'normal' }}
      >
        {question.text}
        {question.isRequired && <Typography component="span" color="error.main" aria-hidden="false">* Required</Typography>}
      </Typography>
      {question.description && (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mt: 0.5 }}
          id={descriptionId}
        >
          {question.description}
        </Typography>
      )}
    </Box>
  );

  const renderSingleChoice = () => (
    <FormControl
      fullWidth
      error={!!error}
      disabled={disabled}
      aria-describedby={question.description ? descriptionId : undefined}
    >
      {renderQuestionText()}
      <RadioGroup
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        aria-labelledby={questionId}
        aria-required={question.isRequired}
      >
        {question.options?.map((option: QuestionOption) => (
          <FormControlLabel
            key={option.id}
            value={option.value}
            control={<Radio />}
            label={option.text}
          />
        ))}
      </RadioGroup>
      {error && <FormHelperText id={errorId} error>{error}</FormHelperText>}
    </FormControl>
  );

  const renderMultipleChoice = () => {
    const selectedValues = Array.isArray(value) ? value : [];
    const checkboxGroupId = `${questionId}-checkbox-group`;

    const handleToggle = (optionValue: string | number) => {
      const newSelectedValues = [...selectedValues];
      const index = newSelectedValues.indexOf(optionValue);

      if (index === -1) {
        newSelectedValues.push(optionValue);
      } else {
        newSelectedValues.splice(index, 1);
      }

      onChange(newSelectedValues);
    };

    return (
      <FormControl
        fullWidth
        error={!!error}
        disabled={disabled}
        aria-describedby={question.description ? descriptionId : undefined}
      >
        {renderQuestionText()}
        <Box
          role="group"
          aria-labelledby={questionId}
          id={checkboxGroupId}
        >
          <Stack spacing={1}>
            {question.options?.map((option: QuestionOption) => (
              <FormControlLabel
                key={option.id}
                control={
                  <Checkbox
                    checked={selectedValues.includes(option.value)}
                    onChange={() => handleToggle(option.value)}
                    inputProps={{
                      'aria-describedby': question.description ? descriptionId : undefined
                    }}
                  />
                }
                label={option.text}
              />
            ))}
          </Stack>
        </Box>
        {error && <FormHelperText id={errorId} error>{error}</FormHelperText>}
        {!error && selectedValues.length > 0 && (
          <FormHelperText>
            {selectedValues.length} {selectedValues.length === 1 ? 'option' : 'options'} selected
          </FormHelperText>
        )}
      </FormControl>
    );
  };

  const renderShortText = () => (
    <FormControl fullWidth error={!!error} disabled={disabled}>
      {renderQuestionText()}
      <TextField
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        fullWidth
        variant="outlined"
        inputProps={{
          maxLength: validations?.maxLength
        }}
        helperText={
          error ||
          (validations?.minLength && `Minimum length: ${validations.minLength} characters`)
        }
        error={!!error}
      />
    </FormControl>
  );

  const renderLongText = () => (
    <FormControl fullWidth error={!!error} disabled={disabled}>
      {renderQuestionText()}
      <TextField
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        fullWidth
        multiline
        rows={4}
        variant="outlined"
        inputProps={{
          maxLength: validations?.maxLength
        }}
        helperText={
          error ||
          (validations?.minLength && `Minimum length: ${validations.minLength} characters`) ||
          (validations?.maxLength && `Maximum length: ${validations.maxLength} characters`)
        }
        error={!!error}
      />
    </FormControl>
  );

  const renderRating = () => {
    const max = validations?.max || 5;

    return (
      <FormControl fullWidth error={!!error} disabled={disabled}>
        {renderQuestionText()}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Rating
            value={Number(value) || 0}
            onChange={(_, newValue) => onChange(newValue)}
            max={max}
            size="large"
          />
          <Typography variant="body2" sx={{ ml: 2 }}>
            {value ? `${value}/${max}` : 'Select a rating'}
          </Typography>
        </Box>
        {error && <FormHelperText error>{error}</FormHelperText>}
      </FormControl>
    );
  };

  const renderScale = () => {
    const min = validations?.min || 1;
    const max = validations?.max || 10;
    const step = question.metadata?.step || 1;

    return (
      <FormControl fullWidth error={!!error} disabled={disabled}>
        {renderQuestionText()}
        <Box sx={{ px: 2, py: 3 }}>
          <Slider
            value={Number(value) || min}
            onChange={(_, newValue) => onChange(newValue)}
            min={min}
            max={max}
            step={step}
            marks
            valueLabelDisplay="on"
          />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
            <Typography variant="caption">
              {question.options?.[0]?.text || min}
            </Typography>
            <Typography variant="caption">
              {question.options?.[question.options.length - 1]?.text || max}
            </Typography>
          </Box>
        </Box>
        {error && <FormHelperText error>{error}</FormHelperText>}
      </FormControl>
    );
  };

  const renderBoolean = () => (
    <FormControl fullWidth error={!!error} disabled={disabled}>
      {renderQuestionText()}
      <ToggleButtonGroup
        value={value !== null && value !== undefined ? value.toString() : ''}
        exclusive
        onChange={(_, newValue) => {
          if (newValue !== null) {
            onChange(newValue === 'true');
          }
        }}
        fullWidth
        sx={{ mt: 1 }}
      >
        <ToggleButton value="true">Yes</ToggleButton>
        <ToggleButton value="false">No</ToggleButton>
      </ToggleButtonGroup>
      {error && <FormHelperText error>{error}</FormHelperText>}
    </FormControl>
  );

  const renderSlider = () => {
    const min = validations?.min || 0;
    const max = validations?.max || 100;
    const step = question.metadata?.step || 1;

    return (
      <FormControl fullWidth error={!!error} disabled={disabled}>
        {renderQuestionText()}
        <Box sx={{ px: 2, py: 3 }}>
          <Slider
            value={Number(value) || min}
            onChange={(_, newValue) => onChange(newValue)}
            min={min}
            max={max}
            step={step}
            valueLabelDisplay="auto"
          />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
            <Typography variant="caption">
              {question.options?.[0]?.text || min}
            </Typography>
            <Typography variant="caption">
              {question.options?.[question.options.length - 1]?.text || max}
            </Typography>
          </Box>
        </Box>
        {error && <FormHelperText error>{error}</FormHelperText>}
      </FormControl>
    );
  };

  // Render different question types
  switch (question.type) {
    case QuestionType.SINGLE_CHOICE:
      return renderSingleChoice();
    case QuestionType.MULTIPLE_CHOICE:
      return renderMultipleChoice();
    case QuestionType.SHORT_TEXT:
      return renderShortText();
    case QuestionType.LONG_TEXT:
      return renderLongText();
    case QuestionType.RATING:
      return renderRating();
    case QuestionType.SCALE:
      return renderScale();
    case QuestionType.BOOLEAN:
      return renderBoolean();
    case QuestionType.SLIDER:
      return renderSlider();
    default:
      return (
        <Typography color="error">
          Unknown question type: {question.type}
        </Typography>
      );
  }
};

export default QuestionRenderer;
