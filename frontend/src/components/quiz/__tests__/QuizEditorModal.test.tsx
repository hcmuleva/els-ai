import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import QuizEditorModal from '../QuizEditorModal';

const mockApiFetch = jest.fn();

const mockUser = {
  id: 'user1',
  role: 'superadmin',
  organizationId: 'org1',
  firstName: 'Test',
  lastName: 'User'
};

const mockQuizData = {
  id: 'quiz1',
  title: 'Test Quiz Title',
  description: 'Test Quiz Description',
  class_level: 'UKG',
  class_id: 'class1',
  subject: 'Math',
  subject_id: 'subject1',
  quiz_type: 'single_choice',
  difficulty_level: 'Easy',
  is_published: false,
};

describe('QuizEditorModal CRUD', () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
  });

  it('validates empty title on submit (CREATE)', async () => {
    mockApiFetch.mockImplementation((url) => {
      if (url.includes('/quizzes/quiz1')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ ...mockQuizData, title: '' }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });

    const { getByText, getByTestId, queryByText, queryByTestId, getAllByText } = await render(
      <QuizEditorModal
        visible={true}
        quizId="quiz1"
        apiFetch={mockApiFetch}
        onClose={jest.fn()}
        onUpdated={jest.fn()}
        user={mockUser as any}
      />
    );

    const saveBtn = getByText('Save');
    fireEvent.press(saveBtn);

    await waitFor(() => {
      expect(getByText('Title is required')).toBeTruthy();
    });
  });

  it('pre-populates form for existing quiz (UPDATE)', async () => {
    mockApiFetch.mockImplementation((url) => {
      if (url.includes('/quizzes/quiz1')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockQuizData),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });

    const { getByText, getByTestId, queryByText, queryByTestId, getAllByText, getByDisplayValue } = await render(
      <QuizEditorModal
        visible={true}
        quizId="quiz1"
        apiFetch={mockApiFetch}
        onClose={jest.fn()}
        onUpdated={jest.fn()}
        user={mockUser as any}
      />
    );

    await waitFor(() => {
      expect(getByDisplayValue('Test Quiz Title')).toBeTruthy();
      expect(getByDisplayValue('Test Quiz Description')).toBeTruthy();
    });
  });

  it('submits updated quiz data successfully (UPDATE)', async () => {
    mockApiFetch.mockImplementation((url) => {
      if (url.includes('/quizzes/quiz1')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockQuizData),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });

    const { getByText, getByTestId, queryByText, queryByTestId, getAllByText, getByDisplayValue } = await render(
      <QuizEditorModal
        visible={true}
        quizId="quiz1"
        apiFetch={mockApiFetch}
        onClose={jest.fn()}
        onUpdated={jest.fn()}
        user={mockUser as any}
      />
    );

    // Wait for prepopulation
    await waitFor(() => {
      expect(getByDisplayValue('Test Quiz Title')).toBeTruthy();
    });

    // Change title
    fireEvent.changeText(getByDisplayValue('Test Quiz Title'), 'Updated Quiz Title');

    await waitFor(() => {
      expect(getByDisplayValue('Updated Quiz Title')).toBeTruthy();
    });

    // Click save
    mockApiFetch.mockImplementation((url, options) => {
      if (options?.method === 'PUT' || options?.method === 'PATCH') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 'quiz1' }) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    fireEvent.press(getByText('Save'));

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        expect.stringContaining('/quizzes/quiz1'),
        expect.objectContaining({
          method: expect.stringMatching(/PATCH|PUT/),
          body: expect.stringContaining('Updated Quiz Title'),
        })
      );
    });
  });
});
