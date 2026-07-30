import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import QuestionsTab from '../QuestionsTab';

// Mock dependencies
jest.mock('expo-av', () => ({
  Audio: {
    setAudioModeAsync: jest.fn(),
    Sound: {
      createAsync: jest.fn().mockResolvedValue({
        sound: {
          unloadAsync: jest.fn(),
          playAsync: jest.fn(),
          pauseAsync: jest.fn(),
        }
      })
    }
  }
}));

jest.mock('../../../hooks/usePaginatedResource', () => ({
  usePaginatedResource: jest.fn()
}));

import { usePaginatedResource } from '../../../hooks/usePaginatedResource';

const mockSubjects = [{ id: 'subject1', title: 'Mathematics', classLevel: 'UKG', class_level: 'UKG', class_id: 'class1', description: 'Math course' }];

const mockUser = {
  id: 'user1',
  role: 'superadmin', activeRole: 'superadmin',
  organizationId: 'org1',
  firstName: 'Test',
  lastName: 'User'
};

const mockQuestions = [
  {
    id: 'q1',
    quiz_id: 'quiz1',
    quiz_title: 'Math Quiz',
    class_level: 'LKG',
    subject: 'Mathematics',
    quiz_type: 'single_choice',
    question_type: 'single_choice',
    question_title: 'What is 2+2?',
    time_limit_seconds: 30,
    points: 10,
    created_at: '2023-01-01T00:00:00.000Z'
  }
];

describe('QuestionsTab CRUD component', () => {
  let mockApiFetch: jest.Mock;
  let mockOnOpenCreate: jest.Mock;
  let mockOnQuestionAction: jest.Mock;
  
  beforeEach(() => {
    mockApiFetch = jest.fn();
    mockOnOpenCreate = jest.fn();
    mockOnQuestionAction = jest.fn();
    
    // Default paginated resource mock
    (usePaginatedResource as jest.Mock).mockReturnValue({
      data: mockQuestions,
      loading: false,
      error: null,
      fetchMore: jest.fn(),
      refresh: jest.fn(),
      hasMore: false,
      totalCount: 1,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders questions correctly (READ)', async () => {
    const { getByText, getByTestId, queryByText, queryByTestId, getAllByText } = await render(
      <QuestionsTab
        user={mockUser as any}
        apiFetch={mockApiFetch}
        filters={{ search: '', classLevel: 'All Classes', subject: 'All Subjects', category: 'All Types' }}
        onFiltersChange={jest.fn()}
        onApplyFilters={jest.fn()}
        onOpenCreate={mockOnOpenCreate}
        onQuestionAction={mockOnQuestionAction}
        deletingQuestionId={null}
        subjectCatalog={mockSubjects}
      />
    );

    await waitFor(() => {
      expect(getByText('What is 2+2?')).toBeTruthy();
      expect(getByText('Math Quiz')).toBeTruthy();
    });
  });

  it('shows empty state when no questions exist (READ - Empty)', async () => {
    (usePaginatedResource as jest.Mock).mockReturnValue({
      data: [],
      loading: false,
      error: null,
      fetchMore: jest.fn(),
      refresh: jest.fn(),
      hasMore: false,
      totalCount: 0,
    });

    const { getByText, getByTestId, queryByText, queryByTestId, getAllByText } = await render(
      <QuestionsTab
        user={mockUser as any}
        apiFetch={mockApiFetch}
        filters={{ search: '', classLevel: 'All Classes', subject: 'All Subjects', category: 'All Types' }}
        onFiltersChange={jest.fn()}
        onApplyFilters={jest.fn()}
        onOpenCreate={mockOnOpenCreate}
        onQuestionAction={mockOnQuestionAction}
        deletingQuestionId={null}
        subjectCatalog={mockSubjects}
      />
    );

    expect(getByText('No questions found')).toBeTruthy();
    expect(getByText('Create Question')).toBeTruthy();
  });

  it('calls onOpenCreate when Create Question button is pressed (CREATE)', async () => {
    (usePaginatedResource as jest.Mock).mockReturnValue({
      data: [],
      loading: false,
      error: null,
      fetchMore: jest.fn(),
      refresh: jest.fn(),
      hasMore: false,
      totalCount: 0,
    });

    const { getByText, getByTestId, queryByText, queryByTestId, getAllByText } = await render(
      <QuestionsTab
        user={mockUser as any}
        apiFetch={mockApiFetch}
        filters={{ search: '', classLevel: 'All Classes', subject: 'All Subjects', category: 'All Types' }}
        onFiltersChange={jest.fn()}
        onApplyFilters={jest.fn()}
        onOpenCreate={mockOnOpenCreate}
        onQuestionAction={mockOnQuestionAction}
        deletingQuestionId={null}
        subjectCatalog={mockSubjects}
      />
    );

    fireEvent.press(getByText('Create Question'));
    expect(mockOnOpenCreate).toHaveBeenCalled();
  });

  it('opens confirmation modal and triggers delete on confirmation (DELETE)', async () => {
    const { getByText, getByTestId, queryByText, queryByTestId, getAllByText } = await render(
      <QuestionsTab
        user={mockUser as any}
        apiFetch={mockApiFetch}
        filters={{ search: '', classLevel: 'All Classes', subject: 'All Subjects', category: 'All Types' }}
        onFiltersChange={jest.fn()}
        onApplyFilters={jest.fn()}
        onOpenCreate={mockOnOpenCreate}
        onQuestionAction={mockOnQuestionAction}
        deletingQuestionId={null}
        subjectCatalog={mockSubjects}
      />
    );

    // Press the Delete button on the item card (from the QCard component)
    // There might be multiple 'Delete' texts, one in footer and one in modal
    const deleteButtons = getAllByText('Delete');
    fireEvent.press(deleteButtons[0]);

    // The ConfirmModal should appear
    await waitFor(() => {
      expect(getByText('Delete Question')).toBeTruthy();
    });

    // Confirm deletion
    const confirmDeleteBtn = getAllByText('Delete')[1]; // usually the second one is in the modal
    fireEvent.press(confirmDeleteBtn);

    expect(mockOnQuestionAction).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'q1' }),
      'delete'
    );
  });
});
