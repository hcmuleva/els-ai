--
-- PostgreSQL database dump
--

\restrict d8Z7vltaDCe2pMUFALA4h0B59I1h8xou13ncgB1pFLshh0LMXwlkUJdCnKefB10

-- Dumped from database version 17.6 (Homebrew)
-- Dumped by pg_dump version 17.6 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: generate_registration_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_registration_id() RETURNS text
    LANGUAGE plpgsql
    AS $$
      BEGIN
        RETURN 'ELS-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', '') FROM 1 FOR 10));
      END;
      $$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: achievements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.achievements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    name character varying(100) NOT NULL,
    emoji character varying(20) NOT NULL,
    description text,
    color character varying(20) DEFAULT '#4A90E2'::character varying NOT NULL,
    is_global boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    asset_type character varying(50),
    file_url text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: assignment_submissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assignment_submissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    assignment_ref_id uuid,
    assignment_title character varying(255),
    file_url text,
    submission_status character varying(50) DEFAULT 'pending'::character varying,
    submitted_at timestamp without time zone,
    graded_at timestamp without time zone,
    grade integer,
    feedback text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: classroom_assignment_submissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.classroom_assignment_submissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    classroom_assignment_id uuid,
    student_id uuid NOT NULL,
    submission_text text,
    attachment_url text,
    submitted_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: classroom_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.classroom_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    classroom_id uuid,
    title character varying(255) NOT NULL,
    description text,
    attachment_url text,
    instructions text,
    due_date timestamp without time zone,
    is_time_bound boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: classroom_contents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.classroom_contents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    classroom_id uuid,
    content_id uuid,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: classroom_quizzes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.classroom_quizzes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    classroom_id uuid,
    quiz_id uuid,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: classroom_student_remarks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.classroom_student_remarks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    classroom_id uuid,
    student_id uuid NOT NULL,
    teacher_id uuid NOT NULL,
    remark_text text,
    parent_note text,
    score_behavior integer,
    score_confidence integer,
    score_participation integer,
    score_performance integer,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    remark_media_url text,
    CONSTRAINT classroom_student_remarks_score_behavior_check CHECK (((score_behavior >= 1) AND (score_behavior <= 5))),
    CONSTRAINT classroom_student_remarks_score_confidence_check CHECK (((score_confidence >= 1) AND (score_confidence <= 5))),
    CONSTRAINT classroom_student_remarks_score_participation_check CHECK (((score_participation >= 1) AND (score_participation <= 5))),
    CONSTRAINT classroom_student_remarks_score_performance_check CHECK (((score_performance >= 1) AND (score_performance <= 5)))
);


--
-- Name: classrooms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.classrooms (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    schedule_type character varying(20) NOT NULL,
    start_time timestamp without time zone,
    duration_minutes integer DEFAULT 0 NOT NULL,
    class_level character varying(50) NOT NULL,
    created_by uuid NOT NULL,
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    ended_at timestamp without time zone,
    is_global boolean DEFAULT false NOT NULL,
    end_time timestamp with time zone,
    CONSTRAINT classrooms_schedule_type_check CHECK (((schedule_type)::text = ANY ((ARRAY['instant'::character varying, 'scheduled'::character varying])::text[]))),
    CONSTRAINT classrooms_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'active'::character varying, 'completed'::character varying])::text[])))
);


--
-- Name: content_topics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.content_topics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    class_level character varying(50) NOT NULL,
    subject character varying(255) NOT NULL,
    title character varying(255) NOT NULL,
    cover_image text,
    created_by uuid,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    is_global boolean DEFAULT false NOT NULL
);


--
-- Name: invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    subscription_id uuid,
    plan_id uuid,
    invoice_number character varying(40) NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    billing_kind character varying(20) DEFAULT 'subscription'::character varying NOT NULL,
    plan_name character varying(120),
    membership_tier character varying(30),
    billing_cycle character varying(20),
    seat_count integer DEFAULT 1,
    subtotal numeric(12,2) DEFAULT 0 NOT NULL,
    discount_total numeric(12,2) DEFAULT 0 NOT NULL,
    amount_due numeric(12,2) DEFAULT 0 NOT NULL,
    currency character varying(10) DEFAULT 'INR'::character varying NOT NULL,
    period_start timestamp without time zone,
    period_end timestamp without time zone,
    due_at timestamp without time zone,
    issued_at timestamp without time zone DEFAULT now(),
    paid_at timestamp without time zone,
    payment_method character varying(40),
    payment_reference character varying(120),
    notes text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT invoices_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'paid'::character varying, 'expired'::character varying, 'renewed'::character varying, 'cancelled'::character varying])::text[])))
);


--
-- Name: learning_content_sections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.learning_content_sections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    content_id uuid,
    section_order integer NOT NULL,
    content_type character varying(50) NOT NULL,
    media_url text,
    external_url text,
    text_content text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    title character varying(255),
    quiz_id uuid
);


--
-- Name: learning_contents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.learning_contents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    class_level character varying(50) NOT NULL,
    subject character varying(255) NOT NULL,
    title character varying(255) NOT NULL,
    content_type character varying(50) NOT NULL,
    media_url text,
    external_url text,
    text_content text,
    created_by uuid,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    is_global boolean DEFAULT false NOT NULL
);


--
-- Name: notification_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_preferences (
    user_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    enabled_types jsonb DEFAULT '["*"]'::jsonb,
    auto_delete_days integer DEFAULT 5,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: notification_schedules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_schedules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    classroom_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    trigger_type character varying(32) NOT NULL,
    fire_at timestamp with time zone NOT NULL,
    status character varying(16) DEFAULT 'pending'::character varying,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    type character varying(64) NOT NULL,
    category character varying(32) DEFAULT 'system'::character varying NOT NULL,
    title character varying(200) NOT NULL,
    message text NOT NULL,
    status character varying(16) DEFAULT 'unread'::character varying NOT NULL,
    cta_label character varying(60),
    cta_route text,
    metadata jsonb DEFAULT '{}'::jsonb,
    source_event_id uuid,
    parent_notification_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    read_at timestamp with time zone,
    expiry_at timestamp with time zone NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: organization_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organization_subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    plan_id uuid,
    status character varying(20) NOT NULL,
    trial_start_at timestamp without time zone,
    trial_end_at timestamp without time zone,
    starts_at timestamp without time zone,
    ends_at timestamp without time zone,
    final_price numeric(12,2),
    seat_count integer DEFAULT 1,
    offer_discount_percent numeric(5,2) DEFAULT 0 NOT NULL,
    special_discount_percent numeric(5,2) DEFAULT 0 NOT NULL,
    group_discount_percent numeric(5,2) DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT organization_subscriptions_status_check CHECK (((status)::text = ANY ((ARRAY['trialing'::character varying, 'active'::character varying, 'past_due'::character varying, 'cancelled'::character varying, 'expired'::character varying])::text[])))
);


--
-- Name: organizations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organizations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    subdomain character varying(100),
    logo_url text,
    settings jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT now(),
    is_default boolean DEFAULT false NOT NULL,
    logo text,
    updated_at timestamp without time zone DEFAULT now(),
    deleted_at timestamp without time zone
);


--
-- Name: parent_assessments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.parent_assessments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    parent_user_id uuid NOT NULL,
    student_user_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    behavior_score smallint NOT NULL,
    focus_score smallint NOT NULL,
    regularity_score smallint NOT NULL,
    creativity_score smallint NOT NULL,
    academic_score smallint NOT NULL,
    outdoor_activity_score smallint NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT parent_assessments_academic_score_check CHECK (((academic_score >= 0) AND (academic_score <= 10))),
    CONSTRAINT parent_assessments_behavior_score_check CHECK (((behavior_score >= 0) AND (behavior_score <= 10))),
    CONSTRAINT parent_assessments_creativity_score_check CHECK (((creativity_score >= 0) AND (creativity_score <= 10))),
    CONSTRAINT parent_assessments_focus_score_check CHECK (((focus_score >= 0) AND (focus_score <= 10))),
    CONSTRAINT parent_assessments_outdoor_activity_score_check CHECK (((outdoor_activity_score >= 0) AND (outdoor_activity_score <= 10))),
    CONSTRAINT parent_assessments_regularity_score_check CHECK (((regularity_score >= 0) AND (regularity_score <= 10)))
);


--
-- Name: parent_feedback; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.parent_feedback (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    parent_user_id uuid NOT NULL,
    student_user_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    feedback_text text NOT NULL,
    attachment_url text,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: parent_student_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.parent_student_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    parent_user_id uuid,
    student_user_id uuid,
    organization_id uuid,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: question_attempts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.question_attempts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    attempt_id uuid,
    question_id uuid,
    is_correct boolean NOT NULL,
    response_data jsonb DEFAULT '{}'::jsonb,
    time_spent_seconds integer
);


--
-- Name: quiz_questions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quiz_questions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    quiz_id uuid,
    question_type character varying(100) NOT NULL,
    question_title text,
    question_instruction text,
    question_audio text,
    time_limit_seconds integer DEFAULT 30,
    points integer DEFAULT 10,
    sort_order integer,
    question_data jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: quizzes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quizzes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    topic_id uuid,
    title character varying(255) NOT NULL,
    description text,
    thumbnail_image text,
    created_by uuid,
    class_level character varying(50),
    subject character varying(100),
    quiz_type character varying(100) NOT NULL,
    difficulty_level character varying(50),
    background_music_url text,
    theme jsonb DEFAULT '{}'::jsonb,
    total_questions integer DEFAULT 0,
    is_published boolean DEFAULT false,
    is_ai_generated boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    is_global boolean DEFAULT false NOT NULL,
    kind text DEFAULT 'subject'::text NOT NULL
);


--
-- Name: refresh_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.refresh_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    token_hash text NOT NULL,
    device_info text,
    ip_address text,
    expires_at timestamp without time zone NOT NULL,
    revoked boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    role_name character varying(50) NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: stories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    cover_image_url text,
    class_level text,
    scheduled_at timestamp with time zone,
    ended_at timestamp with time zone,
    status text DEFAULT 'draft'::text NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    published_at timestamp with time zone,
    CONSTRAINT stories_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'scheduled'::text, 'live'::text, 'ended'::text])))
);


--
-- Name: story_progress; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.story_progress (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    story_id uuid NOT NULL,
    current_section_id uuid,
    completed_section_ids uuid[] DEFAULT ARRAY[]::uuid[] NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    last_active_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: story_sections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.story_sections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    story_id uuid NOT NULL,
    title text NOT NULL,
    body_text text,
    media jsonb DEFAULT '[]'::jsonb NOT NULL,
    quiz_id uuid,
    order_index integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: student_achievements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.student_achievements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id uuid NOT NULL,
    classroom_id uuid,
    achievement_id uuid,
    granted_by uuid NOT NULL,
    granted_at timestamp without time zone DEFAULT now()
);


--
-- Name: student_activity; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.student_activity (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    activity_type character varying(50) NOT NULL,
    reference_id uuid,
    reference_title character varying(255),
    status character varying(50) DEFAULT 'attempted'::character varying,
    score integer,
    time_spent_seconds integer DEFAULT 0,
    activity_date date DEFAULT CURRENT_DATE,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: student_analytics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.student_analytics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    analytics_date date DEFAULT CURRENT_DATE NOT NULL,
    streak_days integer DEFAULT 0,
    consistency_score numeric(5,2) DEFAULT 0,
    attempted_count integer DEFAULT 0,
    not_attempted_count integer DEFAULT 0,
    completed_count integer DEFAULT 0,
    completion_rate numeric(5,2) DEFAULT 0,
    total_time_seconds integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: student_attempts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.student_attempts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id uuid,
    quiz_id uuid,
    score integer NOT NULL,
    total_points integer NOT NULL,
    completed_at timestamp without time zone DEFAULT now()
);


--
-- Name: subjects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subjects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    cover_image text,
    title character varying(255) NOT NULL,
    description text,
    author character varying(255),
    author_user_id uuid,
    is_external_author boolean DEFAULT false,
    class_level character varying(50) NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    icon_image text,
    icon_bg_color character varying(20)
);


--
-- Name: subscription_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscription_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(120) NOT NULL,
    description text,
    membership_tier character varying(30) NOT NULL,
    billing_cycle character varying(20) NOT NULL,
    base_price numeric(12,2) DEFAULT 0 NOT NULL,
    offer_discount_percent numeric(5,2) DEFAULT 0 NOT NULL,
    special_discount_percent numeric(5,2) DEFAULT 0 NOT NULL,
    group_discount_percent numeric(5,2) DEFAULT 0 NOT NULL,
    max_users_for_group_discount integer DEFAULT 10 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT subscription_plans_billing_cycle_check CHECK (((billing_cycle)::text = ANY ((ARRAY['monthly'::character varying, 'quarterly'::character varying, 'yearly'::character varying])::text[]))),
    CONSTRAINT subscription_plans_membership_tier_check CHECK (((membership_tier)::text = ANY ((ARRAY['bronze'::character varying, 'silver'::character varying, 'gold'::character varying, 'platinum'::character varying])::text[])))
);


--
-- Name: teacher_standard_subjects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.teacher_standard_subjects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    teacher_user_id uuid,
    organization_id uuid,
    class_level character varying(50) NOT NULL,
    subject character varying(100) NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: topic_content_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.topic_content_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    topic_id uuid,
    content_id uuid,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: topic_content_sections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.topic_content_sections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    topic_id uuid,
    section_order integer NOT NULL,
    content_type character varying(50) NOT NULL,
    media_url text,
    external_url text,
    text_content text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    title character varying(255)
);


--
-- Name: user_global_publish_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_global_publish_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    enabled boolean DEFAULT false,
    granted_by uuid,
    granted_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: user_org_mapping; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_org_mapping (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    is_primary boolean DEFAULT false NOT NULL,
    joined_at timestamp without time zone DEFAULT now()
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    role_id uuid,
    organization_id uuid,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    first_name character varying(100) NOT NULL,
    last_name character varying(100) NOT NULL,
    email character varying(255) NOT NULL,
    mobile_number character varying(20),
    password_hash text NOT NULL,
    gender character varying(20),
    date_of_birth date,
    education text,
    class_level character varying(50),
    profile_image text,
    is_active boolean DEFAULT true,
    is_verified boolean DEFAULT false,
    last_login_at timestamp without time zone,
    active_role character varying(50) DEFAULT 'student'::character varying,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    deleted_at timestamp without time zone,
    branch character varying(100),
    primary_organization_id uuid,
    unique_registration_id character varying(20) DEFAULT public.generate_registration_id()
);


--
-- Data for Name: achievements; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.achievements (id, organization_id, name, emoji, description, color, is_global, created_at) FROM stdin;
28f7cfde-5c3a-4580-badd-a2d323989be2	8ba8388f-9907-486c-9883-3784c2f2f34e	Best Performer	🏆	Outstanding performance in class	#E6A817	t	2026-05-22 17:15:01.995496
5c38b506-64c6-4db0-9512-7ea1a3f8192c	8ba8388f-9907-486c-9883-3784c2f2f34e	Top Scorer	⭐	Highest quiz score in the session	#FF7043	t	2026-05-22 17:15:01.995496
b9f345b5-6cb5-41c1-808c-86de5c7dceff	8ba8388f-9907-486c-9883-3784c2f2f34e	Consistent Learner	📚	Regularly completes tasks and quizzes	#4A90E2	t	2026-05-22 17:15:01.995496
cb70b9ef-05a2-4bdf-b991-77dd0cf7d43e	8ba8388f-9907-486c-9883-3784c2f2f34e	Creative Thinker	💡	Shows creative problem-solving	#9B8EC4	t	2026-05-22 17:15:01.995496
6a20e380-968c-402d-9434-7d83fc19475a	8ba8388f-9907-486c-9883-3784c2f2f34e	Quick Solver	⚡	Completes assignments faster than average	#7DC67A	t	2026-05-22 17:15:01.995496
4f0b5b08-6d3c-43d6-895a-439a00bb6c8f	8ba8388f-9907-486c-9883-3784c2f2f34e	Team Player	🤝	Collaborates and helps classmates	#E91E8C	t	2026-05-22 17:15:01.995496
0887946a-2fb2-45af-85cb-b1ad27167945	8ba8388f-9907-486c-9883-3784c2f2f34e	Star Student	🌟	All-round excellent student	#FF9800	t	2026-05-22 17:15:01.995496
195b1b5b-c766-4990-9a4f-2de79af1959c	8ba8388f-9907-486c-9883-3784c2f2f34e	Most Improved	📈	Showed the most improvement this session	#00BCD4	t	2026-05-22 17:15:01.995496
68040830-5964-4696-ace9-4e7f3894c873	\N	Best Performer	🏆	Outstanding performance in class	#E6A817	t	2026-05-27 20:00:31.174155
605402ce-9162-4833-9d75-51b2bb89947d	\N	Top Scorer	⭐	Highest quiz score in the session	#FF7043	t	2026-05-27 20:00:31.174155
a4400cd1-da94-4a8e-a67d-b230318979d8	\N	Consistent Learner	📚	Regularly completes tasks and quizzes	#4A90E2	t	2026-05-27 20:00:31.174155
f77d9fcc-2f4b-4fe5-851e-dcaf3e17ed26	\N	Creative Thinker	💡	Shows creative problem-solving	#9B8EC4	t	2026-05-27 20:00:31.174155
e9bb0d49-78c4-4f6a-ac27-24643f6246fc	\N	Quick Solver	⚡	Completes assignments faster than average	#7DC67A	t	2026-05-27 20:00:31.174155
d50a7ac1-b2e8-4996-88ed-fbabd809f587	\N	Team Player	🤝	Collaborates and helps classmates	#E91E8C	t	2026-05-27 20:00:31.174155
0c6af574-bf17-4d3a-b795-50d1e4971753	\N	Star Student	🌟	All-round excellent student	#FF9800	t	2026-05-27 20:00:31.174155
6507a1b6-1ab2-4d0a-8da3-a00dcfb4e836	\N	Most Improved	📈	Showed the most improvement this session	#00BCD4	t	2026-05-27 20:00:31.174155
\.


--
-- Data for Name: assets; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.assets (id, organization_id, asset_type, file_url, metadata, created_at) FROM stdin;
d8214ad0-dbda-42d7-9e75-3548b1095ca8	e6cb98d5-772e-406d-9c9e-a2d77165d4da	image	https://gathjod-emeelan.s3.ap-southeast-2.amazonaws.com/els-media/e6cb98d5-772e-406d-9c9e-a2d77165d4da/image/2026/05/cc0ebda4-d98e-4d9a-98e9-80de04d04f13-.jpg	{"key": "els-media/e6cb98d5-772e-406d-9c9e-a2d77165d4da/image/2026/05/cc0ebda4-d98e-4d9a-98e9-80de04d04f13-.jpg", "context": "subject_cover", "mimeType": "image/jpeg", "uploadedBy": "ebb80c41-ea49-48f9-8396-cdf501feb820", "storedFileName": ".jpeg", "originalFileName": "_.jpeg"}	2026-05-20 16:25:12.532801
ce0da74a-928a-41eb-a7ca-73fface456c2	e6cb98d5-772e-406d-9c9e-a2d77165d4da	image	https://gathjod-emeelan.s3.ap-southeast-2.amazonaws.com/els-media/e6cb98d5-772e-406d-9c9e-a2d77165d4da/image/2026/05/0066476f-3be8-4caa-bbee-e12f67bfff2a-.jpg	{"key": "els-media/e6cb98d5-772e-406d-9c9e-a2d77165d4da/image/2026/05/0066476f-3be8-4caa-bbee-e12f67bfff2a-.jpg", "context": "subject_cover", "mimeType": "image/jpeg", "uploadedBy": "ebb80c41-ea49-48f9-8396-cdf501feb820", "storedFileName": ".jpeg", "originalFileName": "_.jpeg"}	2026-05-20 16:45:38.469286
5ed05bc2-372a-432f-8fea-901ae507cf62	e6cb98d5-772e-406d-9c9e-a2d77165d4da	image	https://gathjod-emeelan.s3.ap-southeast-2.amazonaws.com/els-media/e6cb98d5-772e-406d-9c9e-a2d77165d4da/image/2026/05/fe354e5f-3cd6-44d5-a833-9bdd02d35700-.jpg	{"key": "els-media/e6cb98d5-772e-406d-9c9e-a2d77165d4da/image/2026/05/fe354e5f-3cd6-44d5-a833-9bdd02d35700-.jpg", "context": "subject_cover", "mimeType": "image/jpeg", "uploadedBy": "ebb80c41-ea49-48f9-8396-cdf501feb820", "storedFileName": ".jpeg", "originalFileName": "_.jpeg"}	2026-05-20 16:46:04.722199
b4831d0b-8119-4d75-916b-bf40921d4961	4636b6e2-6858-4667-9945-b897dd501087	image	https://gathjod-emeelan.s3.ap-southeast-2.amazonaws.com/els-media/4636b6e2-6858-4667-9945-b897dd501087/image/2026/05/8c325ff4-9a8d-4cd2-bb17-a025d78b2163-.jpg	{"key": "els-media/4636b6e2-6858-4667-9945-b897dd501087/image/2026/05/8c325ff4-9a8d-4cd2-bb17-a025d78b2163-.jpg", "context": "question_management", "mimeType": "image/jpeg", "uploadedBy": "58ec7031-627b-4016-b2cc-f03fe0963722", "storedFileName": ".jpeg", "originalFileName": "_.jpeg"}	2026-05-20 16:47:44.213222
f1ff0003-024b-4c4a-a3ce-b02ac47d0773	4636b6e2-6858-4667-9945-b897dd501087	image	https://gathjod-emeelan.s3.ap-southeast-2.amazonaws.com/els-media/4636b6e2-6858-4667-9945-b897dd501087/image/2026/05/d7c5aa31-2931-4fac-b161-c026ae25c923-.jpg	{"key": "els-media/4636b6e2-6858-4667-9945-b897dd501087/image/2026/05/d7c5aa31-2931-4fac-b161-c026ae25c923-.jpg", "context": "subject_cover", "mimeType": "image/jpeg", "uploadedBy": "58ec7031-627b-4016-b2cc-f03fe0963722", "storedFileName": ".jpeg", "originalFileName": "_.jpeg"}	2026-05-20 16:49:42.736143
82316380-b91a-45c0-a12f-b6ece4422075	0a58d683-99d6-4e4f-9dc8-cd65eb515091	image	https://gathjod-emeelan.s3.ap-southeast-2.amazonaws.com/els-media/0a58d683-99d6-4e4f-9dc8-cd65eb515091/image/2026/05/4056dfd9-9845-407f-960b-e615e45cdd4c-.jpg	{"key": "els-media/0a58d683-99d6-4e4f-9dc8-cd65eb515091/image/2026/05/4056dfd9-9845-407f-960b-e615e45cdd4c-.jpg", "context": "question_management", "mimeType": "image/jpeg", "uploadedBy": "f6a66183-344f-4f88-bf40-96730c328eca", "storedFileName": ".jpeg", "originalFileName": "_.jpeg"}	2026-05-20 17:16:03.973587
cb5d0c9d-bcb7-4b95-9f71-83d1b24b0d97	0a58d683-99d6-4e4f-9dc8-cd65eb515091	image	https://gathjod-emeelan.s3.ap-southeast-2.amazonaws.com/els-media/0a58d683-99d6-4e4f-9dc8-cd65eb515091/image/2026/05/512a7239-9923-40d2-a37f-161d43e30890-.jpg	{"key": "els-media/0a58d683-99d6-4e4f-9dc8-cd65eb515091/image/2026/05/512a7239-9923-40d2-a37f-161d43e30890-.jpg", "context": "question_management", "mimeType": "image/jpeg", "uploadedBy": "f6a66183-344f-4f88-bf40-96730c328eca", "storedFileName": ".jpeg", "originalFileName": "_.jpeg"}	2026-05-20 17:17:53.874425
efc41a0f-e337-4b7e-b985-b6cd9e466ed1	8fb1f22e-c3af-4f17-9408-361551d0d08d	image	https://gathjod-emeelan.s3.ap-southeast-2.amazonaws.com/els-media/8fb1f22e-c3af-4f17-9408-361551d0d08d/image/2026/05/40770eee-68fc-416e-94e2-147d752401f8-.jpg	{"key": "els-media/8fb1f22e-c3af-4f17-9408-361551d0d08d/image/2026/05/40770eee-68fc-416e-94e2-147d752401f8-.jpg", "context": "question_management", "mimeType": "image/jpeg", "uploadedBy": "6054175b-8b64-4de1-8fc8-4556d82bced2", "storedFileName": ".jpeg", "originalFileName": "_.jpeg"}	2026-05-20 17:35:23.662444
57ae2b51-03fc-40b6-bcbe-0e9dded025bd	8fb1f22e-c3af-4f17-9408-361551d0d08d	image	https://gathjod-emeelan.s3.ap-southeast-2.amazonaws.com/els-media/8fb1f22e-c3af-4f17-9408-361551d0d08d/image/2026/05/bc9d88ed-9573-4ee9-8073-9fc1e320603d-.jpg	{"key": "els-media/8fb1f22e-c3af-4f17-9408-361551d0d08d/image/2026/05/bc9d88ed-9573-4ee9-8073-9fc1e320603d-.jpg", "context": "question_management", "mimeType": "image/jpeg", "uploadedBy": "864b07e8-b841-410a-893f-68fba0114e16", "storedFileName": ".jpeg", "originalFileName": "_.jpeg"}	2026-05-20 17:51:56.262054
17c21d55-d7f7-4a5e-8a06-89e034b98563	d7ed132d-2cea-44d0-83d8-88f9e93b90cd	image	https://gathjod-emeelan.s3.ap-southeast-2.amazonaws.com/els-media/d7ed132d-2cea-44d0-83d8-88f9e93b90cd/image/2026/05/ff4778c7-3c56-4a44-96db-ad62a21af78a-.jpg	{"key": "els-media/d7ed132d-2cea-44d0-83d8-88f9e93b90cd/image/2026/05/ff4778c7-3c56-4a44-96db-ad62a21af78a-.jpg", "context": "question_management", "mimeType": "image/jpeg", "uploadedBy": "181ac5de-fc7b-42dd-8ecd-2ed7039e4004", "storedFileName": ".jpeg", "originalFileName": "_.jpeg"}	2026-05-20 18:05:06.074493
cc8f017e-a75f-4d22-8de9-066962b372a4	d7ed132d-2cea-44d0-83d8-88f9e93b90cd	image	https://gathjod-emeelan.s3.ap-southeast-2.amazonaws.com/els-media/d7ed132d-2cea-44d0-83d8-88f9e93b90cd/image/2026/05/09df15ef-5096-413d-a647-013261139642-.jpg	{"key": "els-media/d7ed132d-2cea-44d0-83d8-88f9e93b90cd/image/2026/05/09df15ef-5096-413d-a647-013261139642-.jpg", "context": "question_management", "mimeType": "image/jpeg", "uploadedBy": "181ac5de-fc7b-42dd-8ecd-2ed7039e4004", "storedFileName": ".jpeg", "originalFileName": "_.jpeg"}	2026-05-20 18:21:02.050046
3abfed49-5baa-448e-b653-3d3d8f0eba62	8ba8388f-9907-486c-9883-3784c2f2f34e	image	https://gathjod-emeelan.s3.ap-southeast-2.amazonaws.com/els-media/8ba8388f-9907-486c-9883-3784c2f2f34e/image/2026/05/9f024477-3fb8-4d0c-8bb4-c354ff9089c8-.jpg	{"key": "els-media/8ba8388f-9907-486c-9883-3784c2f2f34e/image/2026/05/9f024477-3fb8-4d0c-8bb4-c354ff9089c8-.jpg", "context": "question_management", "mimeType": "image/jpeg", "uploadedBy": "866bc022-307f-4218-94a3-7622dd2aec79", "storedFileName": ".jpeg", "originalFileName": "_.jpeg"}	2026-05-21 17:48:41.020791
63a2dd5a-b668-4890-98ab-b8d3edcb3717	8ba8388f-9907-486c-9883-3784c2f2f34e	image	https://gathjod-emeelan.s3.ap-southeast-2.amazonaws.com/els-media/8ba8388f-9907-486c-9883-3784c2f2f34e/image/2026/05/3ed1c724-beff-4dd1-90e0-f912ecee9228-Panchtandrasadhu1.jpg	{"key": "els-media/8ba8388f-9907-486c-9883-3784c2f2f34e/image/2026/05/3ed1c724-beff-4dd1-90e0-f912ecee9228-Panchtandrasadhu1.jpg", "context": "question_management", "mimeType": "image/jpeg", "uploadedBy": "866bc022-307f-4218-94a3-7622dd2aec79", "storedFileName": "Panchtandrasadhu1.jpg", "originalFileName": "Panchtandrasadhu1.jpg"}	2026-05-22 13:37:15.865176
73005aff-c70d-4c4d-bf0a-6f6d2feccd76	8ba8388f-9907-486c-9883-3784c2f2f34e	image	https://gathjod-emeelan.s3.ap-southeast-2.amazonaws.com/els-media/8ba8388f-9907-486c-9883-3784c2f2f34e/image/2026/05/f14bfab9-82ce-4caa-9735-bead1442736a-.jpg	{"key": "els-media/8ba8388f-9907-486c-9883-3784c2f2f34e/image/2026/05/f14bfab9-82ce-4caa-9735-bead1442736a-.jpg", "context": "question_management", "mimeType": "image/jpeg", "uploadedBy": "2bb3d34c-4eae-46bd-8f24-cf1c9096ac70", "storedFileName": ".jpeg", "originalFileName": "_.jpeg"}	2026-05-22 15:40:22.057935
1e297357-73cf-40a9-b836-ca70edf6c520	8ba8388f-9907-486c-9883-3784c2f2f34e	image	https://gathjod-emeelan.s3.ap-southeast-2.amazonaws.com/els-media/8ba8388f-9907-486c-9883-3784c2f2f34e/image/2026/05/1416198d-ed48-4f55-bdf6-940c709b920e-Card_Generated.jpg	{"key": "els-media/8ba8388f-9907-486c-9883-3784c2f2f34e/image/2026/05/1416198d-ed48-4f55-bdf6-940c709b920e-Card_Generated.jpg", "context": "question_management", "mimeType": "image/jpeg", "uploadedBy": "866bc022-307f-4218-94a3-7622dd2aec79", "storedFileName": "Card_Generated.jpg", "originalFileName": "Card_Generated.jpg"}	2026-05-23 14:09:32.453366
5efdd8ed-b772-46dc-87de-4ab52a9c5bdc	8ba8388f-9907-486c-9883-3784c2f2f34e	image	https://gathjod-emeelan.s3.ap-southeast-2.amazonaws.com/els-media/8ba8388f-9907-486c-9883-3784c2f2f34e/image/2026/05/df49e1f1-57f4-44cb-9f36-82eb050a1c05-Card_Generated.jpg	{"key": "els-media/8ba8388f-9907-486c-9883-3784c2f2f34e/image/2026/05/df49e1f1-57f4-44cb-9f36-82eb050a1c05-Card_Generated.jpg", "context": "question_management", "mimeType": "image/jpeg", "uploadedBy": "866bc022-307f-4218-94a3-7622dd2aec79", "storedFileName": "Card_Generated.jpg", "originalFileName": "Card_Generated.jpg"}	2026-05-23 14:13:25.295829
53c929e5-8211-44d7-84a2-5d1dc7b1599f	8ba8388f-9907-486c-9883-3784c2f2f34e	image	https://gathjod-emeelan.s3.ap-southeast-2.amazonaws.com/els-media/8ba8388f-9907-486c-9883-3784c2f2f34e/image/2026/05/2c9702e8-b084-4a19-bbb7-650f3797f03e-5_.jpg	{"key": "els-media/8ba8388f-9907-486c-9883-3784c2f2f34e/image/2026/05/2c9702e8-b084-4a19-bbb7-650f3797f03e-5_.jpg", "context": "question_management", "mimeType": "image/jpeg", "uploadedBy": "2bb3d34c-4eae-46bd-8f24-cf1c9096ac70", "storedFileName": "5_.jpeg", "originalFileName": "_ (5).jpeg"}	2026-05-24 17:26:19.762991
6f41adc3-ed47-45e0-b245-7f610c1fdce9	8ba8388f-9907-486c-9883-3784c2f2f34e	video	https://gathjod-emeelan.s3.ap-southeast-2.amazonaws.com/els-media/8ba8388f-9907-486c-9883-3784c2f2f34e/video/2026/05/e852967f-713b-485b-9f88-9bf084a01cc8-god_vehical.mp4	{"key": "els-media/8ba8388f-9907-486c-9883-3784c2f2f34e/video/2026/05/e852967f-713b-485b-9f88-9bf084a01cc8-god_vehical.mp4", "context": "question_management", "mimeType": "video/mp4", "uploadedBy": "2bb3d34c-4eae-46bd-8f24-cf1c9096ac70", "storedFileName": "god_vehical.mp4", "originalFileName": "god_vehical.mp4"}	2026-05-24 17:38:32.42953
6cdc936b-5f80-437f-86b8-1abd431fd586	8ba8388f-9907-486c-9883-3784c2f2f34e	image	https://gathjod-emeelan.s3.ap-southeast-2.amazonaws.com/els-media/8ba8388f-9907-486c-9883-3784c2f2f34e/image/2026/05/320b413b-2983-46a2-8811-6af83a205f85-4226fd2c-7cb5-4127-b679-f9b15c9c7fa2.svg	{"key": "els-media/8ba8388f-9907-486c-9883-3784c2f2f34e/image/2026/05/320b413b-2983-46a2-8811-6af83a205f85-4226fd2c-7cb5-4127-b679-f9b15c9c7fa2.svg", "context": "question_management", "mimeType": "image/svg+xml", "uploadedBy": "2bb3d34c-4eae-46bd-8f24-cf1c9096ac70", "storedFileName": "4226fd2c-7cb5-4127-b679-f9b15c9c7fa2.svg", "originalFileName": "4226fd2c-7cb5-4127-b679-f9b15c9c7fa2.svg"}	2026-05-24 17:41:08.05356
66be85ec-67d3-4cfb-a323-4911dbb1617f	8ba8388f-9907-486c-9883-3784c2f2f34e	image	https://gathjod-emeelan.s3.ap-southeast-2.amazonaws.com/els-media/8ba8388f-9907-486c-9883-3784c2f2f34e/image/2026/05/2f3f8198-71c6-42cf-9fd2-143366b7194e-4_.jpg	{"key": "els-media/8ba8388f-9907-486c-9883-3784c2f2f34e/image/2026/05/2f3f8198-71c6-42cf-9fd2-143366b7194e-4_.jpg", "context": null, "mimeType": "image/jpeg", "uploadedBy": "fe400696-c6f1-4122-b97e-c7f825f39d25", "storedFileName": "4_.jpeg", "originalFileName": "_ (4).jpeg"}	2026-05-28 00:34:54.977776
51662698-83ae-408d-8c2d-5a3478aba56f	8ba8388f-9907-486c-9883-3784c2f2f34e	image	https://gathjod-emeelan.s3.ap-southeast-2.amazonaws.com/els-media/8ba8388f-9907-486c-9883-3784c2f2f34e/image/2026/05/59670b1e-8e45-4496-82f1-d5b7bd6fc596-Lion.jpg	{"key": "els-media/8ba8388f-9907-486c-9883-3784c2f2f34e/image/2026/05/59670b1e-8e45-4496-82f1-d5b7bd6fc596-Lion.jpg", "context": "question_management", "mimeType": "image/jpeg", "uploadedBy": "2bb3d34c-4eae-46bd-8f24-cf1c9096ac70", "storedFileName": "Lion.jpg", "originalFileName": "Lion.jpg"}	2026-05-29 14:16:02.959587
695aee03-1f0e-42a5-a1af-0dfa32d3c12f	8ba8388f-9907-486c-9883-3784c2f2f34e	image	https://gathjod-emeelan.s3.ap-southeast-2.amazonaws.com/els-media/8ba8388f-9907-486c-9883-3784c2f2f34e/image/2026/05/324ee7e7-41f1-4117-858a-064217e071ed-krishna.jpg	{"key": "els-media/8ba8388f-9907-486c-9883-3784c2f2f34e/image/2026/05/324ee7e7-41f1-4117-858a-064217e071ed-krishna.jpg", "context": "question_management", "mimeType": "image/jpeg", "uploadedBy": "2bb3d34c-4eae-46bd-8f24-cf1c9096ac70", "storedFileName": "krishna.jpg", "originalFileName": "krishna.jpg"}	2026-05-29 14:23:35.025775
\.


--
-- Data for Name: assignment_submissions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.assignment_submissions (id, student_id, organization_id, assignment_ref_id, assignment_title, file_url, submission_status, submitted_at, graded_at, grade, feedback, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: classroom_assignment_submissions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.classroom_assignment_submissions (id, classroom_assignment_id, student_id, submission_text, attachment_url, submitted_at, updated_at) FROM stdin;
c143b04c-c0eb-4b28-846d-3c982ecd71b1	539f827a-b570-4750-a815-791c9014f8b5	d263eb62-0c0f-458b-bf31-654549c58655	my tsory	https://gathjod-emeelan.s3.ap-southeast-2.amazonaws.com/els-media/8ba8388f-9907-486c-9883-3784c2f2f34e/image/2026/05/bd85c8d4-4673-4ec5-8219-3448fd301676-.jpg	2026-05-23 18:20:11.990867	2026-05-23 18:20:11.990867
d4de46cd-b76c-4107-a39f-b5dafc57fdb2	5eebd266-8d17-4b16-996e-be2fdea92937	fe400696-c6f1-4122-b97e-c7f825f39d25	my assignemnt	https://gathjod-emeelan.s3.ap-southeast-2.amazonaws.com/els-media/8ba8388f-9907-486c-9883-3784c2f2f34e/image/2026/05/2f3f8198-71c6-42cf-9fd2-143366b7194e-4_.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=AKIAZHJ3QP2JZKCMDCSF%2F20260527%2Fap-southeast-2%2Fs3%2Faws4_request&X-Amz-Date=20260527T190454Z&X-Amz-Expires=3600&X-Amz-Signature=11736fadcaed83d9321f761cb318e325c5429a544929bdd22b04ba7606cad561&X-Amz-SignedHeaders=host&x-amz-checksum-mode=ENABLED&x-id=GetObject	2026-05-28 00:35:05.115628	2026-05-28 00:35:05.115628
\.


--
-- Data for Name: classroom_assignments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.classroom_assignments (id, classroom_id, title, description, attachment_url, instructions, due_date, is_time_bound, created_at, updated_at) FROM stdin;
db56b210-ff5e-4dd7-b286-52a1eb5d6249	d3bdca70-7e23-4794-8a9b-f2f0151e83a0	test assis	test assis	https://gathjod-emeelan.s3.ap-southeast-2.amazonaws.com/els-media/d7ed132d-2cea-44d0-83d8-88f9e93b90cd/image/2026/05/d874c772-e1ef-46db-bfba-02716b71d847-.jpg	test assis	\N	f	2026-05-20 22:09:07.38707	2026-05-20 22:09:07.38707
44377433-582d-449e-b7d6-011bfe024e5c	023cf54f-a457-488c-ad5e-9889819f2273	wriet a story	wriet a story	\N	wriet a story	\N	f	2026-05-22 16:11:53.931511	2026-05-22 16:11:53.931511
539f827a-b570-4750-a815-791c9014f8b5	22637c5c-5d8d-4870-80ea-69146f384a6c	wriet a story	wriet a story	\N	wriet a story	\N	f	2026-05-22 17:30:23.942192	2026-05-22 17:30:23.942192
47e26d7d-8b71-43aa-bc80-2f50af488eb4	1e77a495-0570-417b-a216-7da3ebb7d6d6	CLass 1 Assignment	CLass 1 Assignment	\N	INstructions	\N	f	2026-05-22 18:24:59.941178	2026-05-22 18:24:59.941178
eca71853-14d5-4e3e-8d60-e797921ddaf1	5698e6f4-a943-41e3-b280-43b59f562110	wriet a story	wriet a story	\N	wriet a story	\N	f	2026-05-23 18:59:33.702694	2026-05-23 18:59:33.702694
5eebd266-8d17-4b16-996e-be2fdea92937	540f0a55-8239-42bc-9465-8329541854c7	Alphabet Practice Worksheet	Practice writing the alphabets A to Z in your notebook.	\N	Write each letter 5 times. Bring your notebook to class tomorrow.	\N	f	2026-05-27 23:34:25.486477	2026-05-27 23:34:25.486477
d699a621-9c7f-4d19-8914-97b72303a242	614f3843-4e23-4867-8c85-45e79fd2e859	Draw your favourite animal	A fun drawing activity for little learners.	\N	Draw and colour your favourite animal. Ask a grown-up to help you say its name and the sound it makes!	\N	f	2026-05-29 21:02:27.933903	2026-05-29 21:02:27.933903
f9fe731f-f4fc-4c62-9d25-4aaf7a2c7a3d	614f3843-4e23-4867-8c85-45e79fd2e859	Count things at home	Practise counting with family.	\N	Find 5 round things at home (like a ball or a roti) and count them out loud with your family.	\N	f	2026-05-29 21:02:27.933903	2026-05-29 21:02:27.933903
334543c1-f036-4828-9f60-f1eaf5da0e3d	0472805e-b7db-4684-aae0-5d6f3091db22	Bring a leaf to class	\N	\N	Find a green leaf outside and bring it to show your friends.	\N	f	2026-05-29 21:08:59.478899	2026-05-29 21:08:59.478899
\.


--
-- Data for Name: classroom_contents; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.classroom_contents (id, classroom_id, content_id, sort_order, created_at) FROM stdin;
c969d247-6bed-4e8b-99e5-3b46cadff180	d3bdca70-7e23-4794-8a9b-f2f0151e83a0	0a0a0e68-b880-4365-830f-478cac1d5c8f	0	2026-05-20 22:09:07.38707
d08b6fa9-ae6f-4aae-add3-58ffa2324a31	023cf54f-a457-488c-ad5e-9889819f2273	1974f419-c86e-4cfe-8a18-60f6b504390d	0	2026-05-22 16:11:53.931511
61d8db02-cc8b-4be7-8cc3-229a64f30b7c	023cf54f-a457-488c-ad5e-9889819f2273	dd18c8fc-ca59-45e9-a02d-4cd78023f928	1	2026-05-22 16:11:53.931511
101dba7f-f675-4d44-b5e3-553d198b6a36	22637c5c-5d8d-4870-80ea-69146f384a6c	1974f419-c86e-4cfe-8a18-60f6b504390d	0	2026-05-22 17:30:23.939978
002f46a4-55cf-4959-bbf3-0b0f42721265	22637c5c-5d8d-4870-80ea-69146f384a6c	dd18c8fc-ca59-45e9-a02d-4cd78023f928	1	2026-05-22 17:30:23.939978
0f96fe5c-8bd6-47c8-a93b-6528a86e6c9d	1e77a495-0570-417b-a216-7da3ebb7d6d6	f316f4c9-8b8f-4cc7-a99f-b593fa1fb02c	0	2026-05-22 18:24:59.941178
a7d2e1ad-ae8c-452d-a1c5-585b8b6f964a	1e77a495-0570-417b-a216-7da3ebb7d6d6	b9947905-fc92-41ab-b571-d89a3dd659a3	1	2026-05-22 18:24:59.941178
af80edfd-5504-4f3f-9623-8b62debe7a32	1e77a495-0570-417b-a216-7da3ebb7d6d6	e5c35d8a-3493-4f72-acd6-e4d4b44b8ae1	2	2026-05-22 18:24:59.941178
9680484e-1847-486f-9b13-62a2732a2931	1e77a495-0570-417b-a216-7da3ebb7d6d6	fc7d17ac-33b7-4530-9cd8-45c1176eb760	3	2026-05-22 18:24:59.941178
b3f1e4c6-0813-441f-964e-b06783190082	5698e6f4-a943-41e3-b280-43b59f562110	1974f419-c86e-4cfe-8a18-60f6b504390d	0	2026-05-23 18:59:33.700803
6c314738-44f3-4d32-8f73-15965c269938	5698e6f4-a943-41e3-b280-43b59f562110	dd18c8fc-ca59-45e9-a02d-4cd78023f928	1	2026-05-23 18:59:33.700803
ff162e69-9107-497d-bb90-726e8005e8d6	7377d102-150d-46c0-8518-fcda6a54030d	dd18c8fc-ca59-45e9-a02d-4cd78023f928	0	2026-05-25 21:56:41.827669
983a563f-e19c-48f2-a17d-8e6e988a5d33	7377d102-150d-46c0-8518-fcda6a54030d	2fb51f06-96e1-4646-96a0-75d0df187c83	1	2026-05-25 21:56:41.827669
fd76ab37-9ec3-4d80-892c-0e4d6a20f794	540f0a55-8239-42bc-9465-8329541854c7	f316f4c9-8b8f-4cc7-a99f-b593fa1fb02c	0	2026-05-27 23:34:25.486477
46e7a7f4-a635-47a7-bbde-114616d3a261	540f0a55-8239-42bc-9465-8329541854c7	b9947905-fc92-41ab-b571-d89a3dd659a3	1	2026-05-27 23:34:25.486477
51427a55-ab3d-4de6-92ab-790345d63de6	540f0a55-8239-42bc-9465-8329541854c7	e5c35d8a-3493-4f72-acd6-e4d4b44b8ae1	2	2026-05-27 23:34:25.486477
9e0a00b1-13eb-434d-8385-15de92d4dda3	540f0a55-8239-42bc-9465-8329541854c7	fc7d17ac-33b7-4530-9cd8-45c1176eb760	3	2026-05-27 23:34:25.486477
ee6016ad-4994-480f-abeb-5b61458d2574	f2324692-6dc4-4165-8b0c-61a24a5902cd	dd18c8fc-ca59-45e9-a02d-4cd78023f928	0	2026-05-27 23:34:35.42615
6392f09e-4a0a-481e-964d-7062dba6e39e	f2324692-6dc4-4165-8b0c-61a24a5902cd	2fb51f06-96e1-4646-96a0-75d0df187c83	1	2026-05-27 23:34:35.42615
57ae0087-2ace-4924-8d11-ca2b11183b3c	f2324692-6dc4-4165-8b0c-61a24a5902cd	3240ae39-f4c9-47a1-bcc1-f42abfe35f4b	2	2026-05-27 23:34:35.42615
4ed34d49-0789-4c3d-b84d-b20b4c2c1720	f2324692-6dc4-4165-8b0c-61a24a5902cd	3295472b-08a3-4b2f-a5a9-116e3dd929a0	3	2026-05-27 23:34:35.42615
090a625a-b274-4664-be5f-052a0b9ec750	f2324692-6dc4-4165-8b0c-61a24a5902cd	1979094b-6526-4aa9-a6e4-1790467adfae	4	2026-05-27 23:34:35.42615
479180b0-55c1-45b5-bc84-a009d9a5caca	f2324692-6dc4-4165-8b0c-61a24a5902cd	3c7e9162-e94e-488f-96a4-cf59b3453cc8	5	2026-05-27 23:34:35.42615
15438ee0-4f55-408e-9cfc-fcdf82d77556	f2324692-6dc4-4165-8b0c-61a24a5902cd	649a210b-0d22-4443-b88a-f67af0d0e6a9	6	2026-05-27 23:34:35.42615
d99b9a14-842d-4b3f-afee-b30fe795a764	f2324692-6dc4-4165-8b0c-61a24a5902cd	040dc8a2-5469-4346-b196-60869396865b	7	2026-05-27 23:34:35.42615
e7baa17d-d2fc-43e3-82bf-bcb7f71592fc	f2324692-6dc4-4165-8b0c-61a24a5902cd	85bb8d1f-b2d3-4e99-b413-ef234271815d	8	2026-05-27 23:34:35.42615
edbaa47a-ef18-4dd8-a389-8b4dfb2a646f	f2324692-6dc4-4165-8b0c-61a24a5902cd	853aa843-81a1-4b3f-b6e6-4b63647d805a	9	2026-05-27 23:34:35.42615
897e150d-235b-4dc7-8337-0d59c6365a63	f2324692-6dc4-4165-8b0c-61a24a5902cd	1974f419-c86e-4cfe-8a18-60f6b504390d	10	2026-05-27 23:34:35.42615
a7130ecb-5694-4377-8721-6063544b461b	f2324692-6dc4-4165-8b0c-61a24a5902cd	e35b7086-c0d9-43bc-a61b-5d96f10930f6	11	2026-05-27 23:34:35.42615
daef6f27-b2cd-44af-b956-cdbcaef48440	614f3843-4e23-4867-8c85-45e79fd2e859	9b7d9a5d-b665-48f7-8924-7f4b5478eaa9	0	2026-05-29 21:02:27.933903
2eace49c-c4a4-4990-a530-ebbce9fe1460	614f3843-4e23-4867-8c85-45e79fd2e859	0f25e529-1cb5-49f5-9671-8463f08de3c2	1	2026-05-29 21:02:27.933903
9d9b1d49-dee6-487d-84c6-776e656eb74e	614f3843-4e23-4867-8c85-45e79fd2e859	bebf531e-d4ae-471f-9b81-d25ecdca02ac	2	2026-05-29 21:02:27.933903
e0349f1d-3c9d-484e-a295-73da28514851	614f3843-4e23-4867-8c85-45e79fd2e859	1dd3f060-2a1f-4b5a-b766-917dffc898bd	3	2026-05-29 21:02:27.933903
100ab5d4-ae00-4ed8-ad60-2a4a1f3e5217	614f3843-4e23-4867-8c85-45e79fd2e859	7c44d2b3-fc5b-4c56-8c3a-3879b2e5e52e	4	2026-05-29 21:02:27.933903
67123ff0-4ca1-42fd-b8b0-6e2e6fbac445	614f3843-4e23-4867-8c85-45e79fd2e859	40e619d7-16e6-4e4b-b317-7bb22b86dc61	5	2026-05-29 21:02:27.933903
228acefa-fb98-41d0-9a08-ee8ea66dc07f	614f3843-4e23-4867-8c85-45e79fd2e859	ae68c5a0-5714-45bf-b4e3-951af9c6af7d	6	2026-05-29 21:02:27.933903
52ff0be5-a230-43b5-a8c4-9e859197e937	614f3843-4e23-4867-8c85-45e79fd2e859	06ecf78f-2563-4e8e-816a-8f42188f18ef	7	2026-05-29 21:02:27.933903
fdc98116-7289-45df-a19d-2f2b53e6f668	614f3843-4e23-4867-8c85-45e79fd2e859	9977430e-9123-4751-8327-024d456e896a	8	2026-05-29 21:02:27.933903
b65d7c41-abf1-4a4f-8bb2-2355b442481a	614f3843-4e23-4867-8c85-45e79fd2e859	ebd5a137-e809-4c2a-bf2f-ae06f7862eea	9	2026-05-29 21:02:27.933903
23542cc0-cc63-4530-980f-af740391830c	0472805e-b7db-4684-aae0-5d6f3091db22	9b7d9a5d-b665-48f7-8924-7f4b5478eaa9	0	2026-05-29 21:08:59.478899
622ceebc-7f23-4ef0-bfd2-e13135ec7f0e	0472805e-b7db-4684-aae0-5d6f3091db22	bebf531e-d4ae-471f-9b81-d25ecdca02ac	1	2026-05-29 21:08:59.478899
eddd2b4b-1bc6-43ae-8b46-1234d34b4570	0472805e-b7db-4684-aae0-5d6f3091db22	7c44d2b3-fc5b-4c56-8c3a-3879b2e5e52e	2	2026-05-29 21:08:59.478899
\.


--
-- Data for Name: classroom_quizzes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.classroom_quizzes (id, classroom_id, quiz_id, sort_order, created_at) FROM stdin;
9ff773fe-79cd-4dc6-a7e5-d16156dcf331	023cf54f-a457-488c-ad5e-9889819f2273	b2afc6d9-df09-4405-8c36-cdff8f3b3b89	0	2026-05-22 16:11:53.931511
586c0113-be8d-4dad-8aa1-b454c042ece7	22637c5c-5d8d-4870-80ea-69146f384a6c	b2afc6d9-df09-4405-8c36-cdff8f3b3b89	0	2026-05-22 17:30:23.941188
965274ca-bb49-4c0d-b07a-4c61c998bcdf	1e77a495-0570-417b-a216-7da3ebb7d6d6	f85700b3-faa3-4042-b8c4-c78a31a39610	0	2026-05-22 18:24:59.941178
47617bb1-bd05-4f38-af62-777a05836236	1e77a495-0570-417b-a216-7da3ebb7d6d6	42848837-bd7f-4e3b-b558-2b2805b16192	1	2026-05-22 18:24:59.941178
a48ed41a-ede5-497e-8aa5-ace337143551	1e77a495-0570-417b-a216-7da3ebb7d6d6	99f27629-ef10-4db4-badc-fcc19496503d	2	2026-05-22 18:24:59.941178
944a55aa-08ce-4862-b060-3250541e34cb	5698e6f4-a943-41e3-b280-43b59f562110	b2afc6d9-df09-4405-8c36-cdff8f3b3b89	0	2026-05-23 18:59:33.70213
6dda7c6f-9fcf-40ee-8d27-87cb52ef963e	7377d102-150d-46c0-8518-fcda6a54030d	9e6f205f-b471-4400-9691-befa9cc13c9d	0	2026-05-25 21:56:41.827669
4a1721e2-a50f-45bb-b67b-7d8fdd2065ce	540f0a55-8239-42bc-9465-8329541854c7	f85700b3-faa3-4042-b8c4-c78a31a39610	0	2026-05-27 23:34:25.486477
60801420-e50e-4270-92c5-70a6bae55795	540f0a55-8239-42bc-9465-8329541854c7	42848837-bd7f-4e3b-b558-2b2805b16192	1	2026-05-27 23:34:25.486477
b7c5c6ab-5760-4b96-9124-de807687f301	540f0a55-8239-42bc-9465-8329541854c7	99f27629-ef10-4db4-badc-fcc19496503d	2	2026-05-27 23:34:25.486477
ba105e7b-83c2-4089-9f46-c39d19e6a8a3	f2324692-6dc4-4165-8b0c-61a24a5902cd	9a4c3dfd-1f6a-4379-8bd3-790a95781aab	0	2026-05-27 23:34:35.42615
1be9f244-ae79-440a-98de-efa803b528a4	f2324692-6dc4-4165-8b0c-61a24a5902cd	9e6f205f-b471-4400-9691-befa9cc13c9d	1	2026-05-27 23:34:35.42615
dcd733c6-b9ac-4a56-abc2-d9b1ecc30cb6	ad95dafa-d5ec-49cb-aeb0-5189487e7d25	52edaca0-d62c-47cd-a587-6aeccd7eda7f	0	2026-05-29 16:18:24.637641
0b03dc07-335e-4731-9130-dd7905ae4cc0	ad95dafa-d5ec-49cb-aeb0-5189487e7d25	d9ba92a0-cd24-493c-a7a4-be57a6755e61	1	2026-05-29 16:18:24.637641
30a106d6-d55a-46ac-af2a-a220b8c953a7	ad95dafa-d5ec-49cb-aeb0-5189487e7d25	fa7a6f0c-1a53-4f15-bb9d-cc162985a33c	2	2026-05-29 16:18:24.637641
d59fc52c-9e64-4a74-95ee-ac418a7cf806	614f3843-4e23-4867-8c85-45e79fd2e859	2be08575-5987-4255-9881-20cf6250be1b	0	2026-05-29 21:02:27.933903
dd23b4fb-d39d-4051-8c77-81266150b45b	614f3843-4e23-4867-8c85-45e79fd2e859	5ee076f6-30af-466e-be8c-845ec6c3fe16	1	2026-05-29 21:02:27.933903
6deebc49-3cdd-4ac0-a0c2-6f4ac3353295	614f3843-4e23-4867-8c85-45e79fd2e859	b535df36-c742-4235-84fd-7111abe88b3f	2	2026-05-29 21:02:27.933903
b9b16918-7ba6-4110-b95c-c0f865c490d2	614f3843-4e23-4867-8c85-45e79fd2e859	27544d16-ec5a-4529-85aa-42bd31868291	3	2026-05-29 21:02:27.933903
6a405e8c-9bb3-4e9f-b68f-6c0d07693cea	614f3843-4e23-4867-8c85-45e79fd2e859	a1b3d3c5-157f-4f6b-9eb8-9a4101f86b64	4	2026-05-29 21:02:27.933903
54f49403-77f3-4346-85b9-ab1fc5ee3560	614f3843-4e23-4867-8c85-45e79fd2e859	f1b6e4e0-169e-4f32-a796-bd3abfdb1265	5	2026-05-29 21:02:27.933903
1175f568-8545-48db-b621-076593844c9c	614f3843-4e23-4867-8c85-45e79fd2e859	87da913a-7c5f-4b8c-9b05-ba8589a8c745	6	2026-05-29 21:02:27.933903
efd297ff-025a-4171-b0a5-4a981844af34	614f3843-4e23-4867-8c85-45e79fd2e859	9675eec6-48bd-4f79-a82f-43b112d81259	7	2026-05-29 21:02:27.933903
ad1b87b5-1979-437d-a80e-dfa6001d6bb0	614f3843-4e23-4867-8c85-45e79fd2e859	319442dd-0644-4dad-bb71-cf055cafc3d4	8	2026-05-29 21:02:27.933903
69a30da4-a782-4db4-a831-e44ce2dab7ee	614f3843-4e23-4867-8c85-45e79fd2e859	45578aba-3bad-41e4-bbf3-c7a3de764105	9	2026-05-29 21:02:27.933903
c591dc02-6003-4885-a73d-75c73202aa3a	0472805e-b7db-4684-aae0-5d6f3091db22	2be08575-5987-4255-9881-20cf6250be1b	0	2026-05-29 21:08:59.478899
2c9f53ad-986b-45f6-8d6c-ceb92d5a6a6f	0472805e-b7db-4684-aae0-5d6f3091db22	5ee076f6-30af-466e-be8c-845ec6c3fe16	1	2026-05-29 21:08:59.478899
9429b9fd-dc8b-4e71-93dd-cd7093f8ebb5	0472805e-b7db-4684-aae0-5d6f3091db22	b535df36-c742-4235-84fd-7111abe88b3f	2	2026-05-29 21:08:59.478899
\.


--
-- Data for Name: classroom_student_remarks; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.classroom_student_remarks (id, classroom_id, student_id, teacher_id, remark_text, parent_note, score_behavior, score_confidence, score_participation, score_performance, created_at, updated_at, remark_media_url) FROM stdin;
3dff50cd-5370-4940-b8d5-8805b2af47b9	1e77a495-0570-417b-a216-7da3ebb7d6d6	fe400696-c6f1-4122-b97e-c7f825f39d25	866bc022-307f-4218-94a3-7622dd2aec79	Doing Great	Your Child is Doing Great	5	3	4	3	2026-05-22 18:02:15.650476	2026-05-22 21:36:22.141322	https://gathjod-emeelan.s3.ap-southeast-2.amazonaws.com/els-media/8ba8388f-9907-486c-9883-3784c2f2f34e/image/2026/05/970fdb07-1d87-47c7-beda-b9f8ae9699d5-4226fd2c-7cb5-4127-b679-f9b15c9c7fa2.svg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=AKIAZHJ3QP2JZKCMDCSF%2F20260522%2Fap-southeast-2%2Fs3%2Faws4_request&X-Amz-Date=20260522T125310Z&X-Amz-Expires=3600&X-Amz-Signature=429c2781cebd7b31ce4878e88720c63fb0d09139e18f47311f928e804a452cdf&X-Amz-SignedHeaders=host&x-amz-checksum-mode=ENABLED&x-id=GetObject
0a6cb9d4-954b-42cf-988f-04ec144fe12c	540f0a55-8239-42bc-9465-8329541854c7	fe400696-c6f1-4122-b97e-c7f825f39d25	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	yfyif	gcuc	4	4	5	4	2026-05-24 12:25:15.933439	2026-05-28 00:36:41.036655	
\.


--
-- Data for Name: classrooms; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.classrooms (id, organization_id, title, description, schedule_type, start_time, duration_minutes, class_level, created_by, status, created_at, updated_at, ended_at, is_global, end_time) FROM stdin;
0472805e-b7db-4684-aae0-5d6f3091db22	8ba8388f-9907-486c-9883-3784c2f2f34e	LKG Morning Class - Week 1	A completed LKG class from last week.	instant	\N	40	LKG	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	completed	2026-05-29 21:08:59.478899	2026-05-29 21:08:59.647646	2026-05-29 21:08:59.647646	f	\N
d3bdca70-7e23-4794-8a9b-f2f0151e83a0	d7ed132d-2cea-44d0-83d8-88f9e93b90cd	test classroom	test classroom	instant	\N	45	2	181ac5de-fc7b-42dd-8ecd-2ed7039e4004	active	2026-05-20 21:40:49.796888	2026-05-20 22:09:07.38707	\N	f	\N
023cf54f-a457-488c-ad5e-9889819f2273	8ba8388f-9907-486c-9883-3784c2f2f34e	Class-3rd-Bronz	This is for bronz badge student.	instant	\N	45	3	866bc022-307f-4218-94a3-7622dd2aec79	completed	2026-05-22 13:10:35.145294	2026-05-22 17:27:28.639953	2026-05-22 17:27:28.639953	f	\N
1e77a495-0570-417b-a216-7da3ebb7d6d6	8ba8388f-9907-486c-9883-3784c2f2f34e	Class 1 Classroom	Class 1 Classroom	instant	\N	45	1	866bc022-307f-4218-94a3-7622dd2aec79	active	2026-05-21 17:35:11.765216	2026-05-22 18:24:59.941178	\N	f	\N
22637c5c-5d8d-4870-80ea-69146f384a6c	8ba8388f-9907-486c-9883-3784c2f2f34e	Class-3rd-Bronz (Restarted)	This is for bronz badge student.	instant	2026-05-22 17:30:23.938399	45	3	866bc022-307f-4218-94a3-7622dd2aec79	completed	2026-05-22 17:30:23.938399	2026-05-23 18:56:07.385151	2026-05-23 18:56:07.385151	f	\N
5698e6f4-a943-41e3-b280-43b59f562110	8ba8388f-9907-486c-9883-3784c2f2f34e	Class-3rd-Bronz (Restarted) (Restarted)	This is for bronz badge student.	instant	2026-05-23 18:59:33.698181	45	3	866bc022-307f-4218-94a3-7622dd2aec79	active	2026-05-23 18:59:33.698181	2026-05-23 18:59:33.698181	\N	f	\N
03f438fb-d22e-4ee2-80db-34948b240621	8ba8388f-9907-486c-9883-3784c2f2f34e	Teacher Demo Classroom	Created for hcm teacher dashboard	instant	\N	45	3	70d9527d-011a-4548-ab1b-77a9c050e2dd	active	2026-05-25 21:54:52.905322	2026-05-25 21:54:52.905322	\N	f	\N
7377d102-150d-46c0-8518-fcda6a54030d	8ba8388f-9907-486c-9883-3784c2f2f34e	New Class	\N	instant	\N	45	3	c2fd6bc5-5766-4eba-b691-0438f77e3d33	active	2026-05-25 21:56:30.693084	2026-05-25 21:56:41.827669	\N	f	\N
f2324692-6dc4-4165-8b0c-61a24a5902cd	8ba8388f-9907-486c-9883-3784c2f2f34e	Class 3 Classroom	\N	instant	\N	45	3	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	active	2026-05-23 14:22:34.6864	2026-05-27 23:34:35.42615	\N	f	\N
d782e15c-4b05-453a-ba8b-fd8f313263ab	8ba8388f-9907-486c-9883-3784c2f2f34e	CLASS 1	CLASS 1	instant	2026-05-28 00:22:59.168306	45	1	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	completed	2026-05-27 23:49:01.985119	2026-05-28 00:24:51.486836	2026-05-28 00:24:51.486836	f	\N
540f0a55-8239-42bc-9465-8329541854c7	8ba8388f-9907-486c-9883-3784c2f2f34e	Class 1 English Morning Session	Daily English classroom for Class 1 covering phonics, nouns, and action words.	instant	2026-05-28 00:31:56.888818	45	1	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	active	2026-05-21 17:46:38.934906	2026-05-28 00:31:56.888818	\N	f	\N
35de2e31-8a78-4e3b-952e-ab16fac1c731	8ba8388f-9907-486c-9883-3784c2f2f34e	ClaSS1	ClaSS1	scheduled	2026-05-28 01:12:00	45	1	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	active	2026-05-28 01:06:20.2631	2026-05-28 01:10:25.162005	\N	f	2026-05-28 01:14:00+05:30
ad95dafa-d5ec-49cb-aeb0-5189487e7d25	8ba8388f-9907-486c-9883-3784c2f2f34e	my Class 1 Classroom	my Class 1 Classroom	instant	\N	45	1	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	active	2026-05-28 13:47:05.905479	2026-05-29 16:18:24.637641	\N	f	\N
614f3843-4e23-4867-8c85-45e79fd2e859	8ba8388f-9907-486c-9883-3784c2f2f34e	LKG Daily Learning Class	A playful daily class covering Maths, English, EVS, GK and Moral Values for LKG.	instant	\N	45	LKG	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	active	2026-05-29 21:02:27.933903	2026-05-29 21:02:27.933903	\N	f	\N
\.


--
-- Data for Name: content_topics; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.content_topics (id, organization_id, class_level, subject, title, cover_image, created_by, created_at, updated_at, is_global) FROM stdin;
95ff0bf2-2dec-4b6f-bb92-e14b52f9217b	8ba8388f-9907-486c-9883-3784c2f2f34e	1	English	Alphabet Sounds & Phonics	/media/pictures/alphabet.png	\N	2026-05-21 17:32:02.2573	2026-05-21 17:32:02.2573	f
b9bddfce-76dc-4128-a8ce-ee29092f0dc6	8ba8388f-9907-486c-9883-3784c2f2f34e	1	English	Nouns: Naming Words	/media/pictures/noun.png	\N	2026-05-21 17:32:02.260629	2026-05-21 17:32:02.260629	f
3f958c31-4f27-4e40-8d55-99233727e105	8ba8388f-9907-486c-9883-3784c2f2f34e	1	English	Simple Action Words	/media/pictures/verbs.png	\N	2026-05-21 17:32:02.261706	2026-05-21 17:32:02.261706	f
81a7d72e-9f53-4807-a263-c59450883298	8ba8388f-9907-486c-9883-3784c2f2f34e	3	Hindi Stories	Panchtantra	https://gathjod-emeelan.s3.ap-southeast-2.amazonaws.com/els-media/8ba8388f-9907-486c-9883-3784c2f2f34e/image/2026/05/3ed1c724-beff-4dd1-90e0-f912ecee9228-Panchtandrasadhu1.jpg	866bc022-307f-4218-94a3-7622dd2aec79	2026-05-22 13:37:18.832997	2026-05-22 13:37:18.832997	f
c78ac65b-1a7e-47ed-8f8c-edf26ee40108	8ba8388f-9907-486c-9883-3784c2f2f34e	3	Hindi Stories	test class 2	\N	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	2026-05-22 15:13:52.822132	2026-05-22 15:41:02.685599	f
324f209e-1c97-4822-9238-a3b173e8e71d	8ba8388f-9907-486c-9883-3784c2f2f34e	3	Hindi Stories	Dharmik Kathaye	https://gathjod-emeelan.s3.ap-southeast-2.amazonaws.com/els-media/8ba8388f-9907-486c-9883-3784c2f2f34e/image/2026/05/320b413b-2983-46a2-8811-6af83a205f85-4226fd2c-7cb5-4127-b679-f9b15c9c7fa2.svg	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	2026-05-24 17:41:13.108855	2026-05-24 17:41:13.108855	f
abab4c93-6170-4b8b-b870-53b2204b6d21	8ba8388f-9907-486c-9883-3784c2f2f34e	LKG	Mathematics	Numbers and Counting	\N	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	2026-05-29 18:35:37.956528	2026-05-29 18:35:37.956528	f
6c95753e-72f8-4991-9140-9a191dfd3b09	8ba8388f-9907-486c-9883-3784c2f2f34e	LKG	Mathematics	Shapes and Comparison	\N	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	2026-05-29 18:35:37.986633	2026-05-29 18:35:37.986633	f
8ad4c947-6907-4faf-8979-2b5d383be925	8ba8388f-9907-486c-9883-3784c2f2f34e	LKG	English	Alphabet and Phonics	\N	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	2026-05-29 18:35:38.000616	2026-05-29 18:35:38.000616	f
22bee16a-51d9-4b57-927d-9362be9069ca	8ba8388f-9907-486c-9883-3784c2f2f34e	LKG	English	Simple Words	\N	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	2026-05-29 18:35:38.016563	2026-05-29 18:35:38.016563	f
537a4350-ec04-4f2d-8008-57c438b15c78	8ba8388f-9907-486c-9883-3784c2f2f34e	LKG	EVS	Animals and Homes	\N	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	2026-05-29 18:35:38.031255	2026-05-29 18:35:38.031255	f
05e302de-34ec-4fc3-974f-7870f17100a2	8ba8388f-9907-486c-9883-3784c2f2f34e	LKG	EVS	Plants and Helpers	\N	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	2026-05-29 18:35:38.044584	2026-05-29 18:35:38.044584	f
967b05c6-1a77-4af2-9d59-a9173ccd9841	8ba8388f-9907-486c-9883-3784c2f2f34e	LKG	General Knowledge	Colours and Objects	\N	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	2026-05-29 18:35:38.057804	2026-05-29 18:35:38.057804	f
b0d5556f-c326-4509-a78e-cf5b7f646119	8ba8388f-9907-486c-9883-3784c2f2f34e	LKG	General Knowledge	Transport and Festivals	\N	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	2026-05-29 18:35:38.068989	2026-05-29 18:35:38.068989	f
271dd99c-8da0-4b42-ba47-9ff8edcffab3	8ba8388f-9907-486c-9883-3784c2f2f34e	LKG	Moral Values	Sharing and Caring	\N	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	2026-05-29 18:35:38.082648	2026-05-29 18:35:38.082648	f
cad6a327-c1b2-4dce-a6d8-196fd25ede80	8ba8388f-9907-486c-9883-3784c2f2f34e	LKG	Moral Values	Honesty and Respect	\N	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	2026-05-29 18:35:38.093687	2026-05-29 18:35:38.093687	f
\.


--
-- Data for Name: invoices; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.invoices (id, organization_id, subscription_id, plan_id, invoice_number, status, billing_kind, plan_name, membership_tier, billing_cycle, seat_count, subtotal, discount_total, amount_due, currency, period_start, period_end, due_at, issued_at, paid_at, payment_method, payment_reference, notes, created_at, updated_at) FROM stdin;
969cd24d-3719-4092-b76c-c65ade1b6bd8	8ba8388f-9907-486c-9883-3784c2f2f34e	a73cc5b1-6478-4cd0-87c2-e49ab4daf867	78366682-47b1-4d4a-8865-c2cb6f801cf0	INV-20260527155503-7132	paid	subscription	Bronze Starter	bronze	monthly	25	24975.00	0.00	24975.00	INR	2026-05-27 21:25:03.162	2026-06-27 21:25:03.162	2026-06-27 21:25:03.162	2026-05-27 21:25:03.164771	2026-05-27 23:03:21.145047	cashfree-upi	PG-MOCK-1779903201091	\N	2026-05-27 21:25:03.164771	2026-05-27 23:03:21.145047
91672d73-3b67-4d2d-bcc7-bd6fcb7e6e34	8ba8388f-9907-486c-9883-3784c2f2f34e	9d81ac9c-0240-419d-9501-61c716579a06	78366682-47b1-4d4a-8865-c2cb6f801cf0	INV-20260527155502-6404	paid	subscription	Bronze Starter	bronze	monthly	25	24975.00	0.00	24975.00	INR	2026-05-27 21:25:02.353	2026-06-27 21:25:02.353	2026-06-27 21:25:02.353	2026-05-27 21:25:02.355816	2026-05-27 23:03:35.186515	cashfree-card	PG-MOCK-1779903215119	\N	2026-05-27 21:25:02.355816	2026-05-27 23:03:35.186515
\.


--
-- Data for Name: learning_content_sections; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.learning_content_sections (id, content_id, section_order, content_type, media_url, external_url, text_content, created_at, updated_at, title, quiz_id) FROM stdin;
04706451-b76b-420b-90e2-37c70050e85e	fc7d17ac-33b7-4530-9cd8-45c1176eb760	1	text	\N	\N	Welcome to Phonics! Let's learn the sounds of English letters. 'A' says /æ/ as in Apple. 'B' says /b/ as in Ball. 'C' says /k/ as in Cat.	2026-05-21 17:32:02.258611	2026-05-21 17:32:02.258611	\N	\N
12a766c6-a56e-4103-9558-77c47970bcbf	b9947905-fc92-41ab-b571-d89a3dd659a3	1	text	\N	\N	A noun is a naming word. It names a person, place, animal, or thing. Examples: Boy (person), School (place), Dog (animal), Toy (thing).	2026-05-21 17:48:03.395217	2026-05-21 17:48:03.395217	Noun Title	\N
f444b2c0-0186-4d22-b14b-760e0b5be293	e5c35d8a-3493-4f72-acd6-e4d4b44b8ae1	1	audio	/media/bg-audio/eliveta-kids-happy-music-474162.mp3	\N	Listen to the sounds of the letters and repeat them aloud.	2026-05-21 17:48:20.07092	2026-05-21 17:48:20.07092	Audio Title	\N
5dc2e66b-17c8-4b57-9f02-4a3fb162555c	f316f4c9-8b8f-4cc7-a99f-b593fa1fb02c	1	text	\N	\N	Action words tell us what someone or something is doing. Examples: run, jump, read, write, play, sleep.	2026-05-21 17:49:26.845388	2026-05-21 17:49:26.845388	Introduction	\N
1d499755-b0bb-44ec-9fcd-e8e2f9720eb6	f316f4c9-8b8f-4cc7-a99f-b593fa1fb02c	2	image	https://gathjod-emeelan.s3.ap-southeast-2.amazonaws.com/els-media/8ba8388f-9907-486c-9883-3784c2f2f34e/image/2026/05/9f024477-3fb8-4d0c-8bb4-c354ff9089c8-.jpg	\N	\N	2026-05-21 17:49:26.845388	2026-05-21 17:49:26.845388	Title 2 section	\N
486ae920-e9f7-424b-aca1-ec8ae526b6ba	f316f4c9-8b8f-4cc7-a99f-b593fa1fb02c	3	youtube_url	\N	https://www.youtube.com/watch?v=tcv1_fRwjYs&pp=ygUDYWJj	\N	2026-05-21 17:49:26.845388	2026-05-21 17:49:26.845388	Title 3 Section	\N
b9325810-20f0-44d7-b0b2-0bcfdc5b078a	dd18c8fc-ca59-45e9-a02d-4cd78023f928	1	youtube_url	\N	https://www.youtube.com/watch?v=KxSEYA04Rvg&list=PLsWoRuvTLq-1ALHPvkvwHBZHkNAEPFYxb&index=2	\N	2026-05-22 15:40:37.163053	2026-05-22 15:40:37.163053	Video Title	\N
bdcf32bb-7474-44a0-92b0-feba25444a01	dd18c8fc-ca59-45e9-a02d-4cd78023f928	2	image	https://gathjod-emeelan.s3.ap-southeast-2.amazonaws.com/els-media/8ba8388f-9907-486c-9883-3784c2f2f34e/image/2026/05/f14bfab9-82ce-4caa-9735-bead1442736a-.jpg	\N	\N	2026-05-22 15:40:37.163053	2026-05-22 15:40:37.163053	Conetnt oimgee	\N
842970cb-1ef0-4eb7-93e3-23275f0c358d	1979094b-6526-4aa9-a6e4-1790467adfae	1	image	https://gathjod-emeelan.s3.ap-southeast-2.amazonaws.com/els-media/8ba8388f-9907-486c-9883-3784c2f2f34e/video/2026/05/e852967f-713b-485b-9f88-9bf084a01cc8-god_vehical.mp4	\N	\N	2026-05-24 17:40:13.208713	2026-05-24 17:40:13.208713	\N	\N
58675b11-8796-46b0-9158-443446911276	9b7d9a5d-b665-48f7-8924-7f4b5478eaa9	1	text	\N	\N	Simple Mathematics concepts for LKG: Numbers and Counting with visuals, actions, and repetition.	2026-05-29 19:06:26.13386	2026-05-29 19:06:26.13386	Summary	\N
ae025325-4e83-40bf-a4bc-9ad3b487d06a	9b7d9a5d-b665-48f7-8924-7f4b5478eaa9	2	youtube_url	\N	https://www.youtube.com/watch?v=DR-cfDsHCGA	\N	2026-05-29 19:06:26.13386	2026-05-29 19:06:26.13386	Watch & Learn 1	\N
1719adb0-ca56-4ea7-9986-bd41798737f5	9b7d9a5d-b665-48f7-8924-7f4b5478eaa9	3	youtube_url	\N	https://www.youtube.com/watch?v=HrxZWNu72WI	\N	2026-05-29 19:06:26.13386	2026-05-29 19:06:26.13386	Watch & Learn 2	\N
df0c955c-b8e5-42c5-bcd7-e8351b4fe82b	9b7d9a5d-b665-48f7-8924-7f4b5478eaa9	4	text	\N	\N	Show picture cards, ask children to answer by tapping, matching, and speaking.	2026-05-29 19:06:26.13386	2026-05-29 19:06:26.13386	Classroom Activity	2be08575-5987-4255-9881-20cf6250be1b
cfc87206-8f18-498e-a533-ffe296e289ef	0f25e529-1cb5-49f5-9671-8463f08de3c2	1	text	\N	\N	Simple Mathematics concepts for LKG: Shapes and Comparison with visuals, actions, and repetition.	2026-05-29 19:06:26.15468	2026-05-29 19:06:26.15468	Summary	\N
e8d6b408-8721-43fe-bdf8-3aa9e94532f4	0f25e529-1cb5-49f5-9671-8463f08de3c2	2	youtube_url	\N	https://www.youtube.com/watch?v=HrxZWNu72WI	\N	2026-05-29 19:06:26.15468	2026-05-29 19:06:26.15468	Watch & Learn 1	\N
8fb102ea-6dd0-417a-a3b4-af6023834334	0f25e529-1cb5-49f5-9671-8463f08de3c2	3	youtube_url	\N	https://www.youtube.com/watch?v=DR-cfDsHCGA	\N	2026-05-29 19:06:26.15468	2026-05-29 19:06:26.15468	Watch & Learn 2	\N
c304fab1-879f-48c3-aafd-0c9ff9017e15	0f25e529-1cb5-49f5-9671-8463f08de3c2	4	text	\N	\N	Show picture cards, ask children to answer by tapping, matching, and speaking.	2026-05-29 19:06:26.15468	2026-05-29 19:06:26.15468	Classroom Activity	5ee076f6-30af-466e-be8c-845ec6c3fe16
d4055a65-bd00-47e2-93e9-c8472235100f	bebf531e-d4ae-471f-9b81-d25ecdca02ac	1	text	\N	\N	Simple English concepts for LKG: Alphabet and Phonics with visuals, actions, and repetition.	2026-05-29 19:06:26.1703	2026-05-29 19:06:26.1703	Summary	\N
cb8c7280-818d-41d3-aff5-15538bcb0d5a	bebf531e-d4ae-471f-9b81-d25ecdca02ac	2	youtube_url	\N	https://www.youtube.com/watch?v=75p-N9YKqNo	\N	2026-05-29 19:06:26.1703	2026-05-29 19:06:26.1703	Watch & Learn 1	\N
25cc7b0c-0c4b-4561-9189-3d48d61cc456	bebf531e-d4ae-471f-9b81-d25ecdca02ac	3	youtube_url	\N	https://www.youtube.com/watch?v=BELlZKpi1Zs	\N	2026-05-29 19:06:26.1703	2026-05-29 19:06:26.1703	Watch & Learn 2	\N
0b2039a4-b840-441a-a606-8cf6f4d0a33e	bebf531e-d4ae-471f-9b81-d25ecdca02ac	4	text	\N	\N	Show picture cards, ask children to answer by tapping, matching, and speaking.	2026-05-29 19:06:26.1703	2026-05-29 19:06:26.1703	Classroom Activity	b535df36-c742-4235-84fd-7111abe88b3f
1160223f-59a4-4271-8fe5-7d25b5742283	1dd3f060-2a1f-4b5a-b766-917dffc898bd	1	text	\N	\N	Simple English concepts for LKG: Simple Words with visuals, actions, and repetition.	2026-05-29 19:06:26.184815	2026-05-29 19:06:26.184815	Summary	\N
22683fdf-dbd9-46fa-bd2c-c1638a4231b4	1dd3f060-2a1f-4b5a-b766-917dffc898bd	2	youtube_url	\N	https://www.youtube.com/watch?v=BELlZKpi1Zs	\N	2026-05-29 19:06:26.184815	2026-05-29 19:06:26.184815	Watch & Learn 1	\N
8ba09501-f650-4b63-bd6c-bb45519b3a02	1dd3f060-2a1f-4b5a-b766-917dffc898bd	3	youtube_url	\N	https://www.youtube.com/watch?v=75p-N9YKqNo	\N	2026-05-29 19:06:26.184815	2026-05-29 19:06:26.184815	Watch & Learn 2	\N
50f1a155-b584-4c86-95ca-44fe7d2fbd56	1dd3f060-2a1f-4b5a-b766-917dffc898bd	4	text	\N	\N	Show picture cards, ask children to answer by tapping, matching, and speaking.	2026-05-29 19:06:26.184815	2026-05-29 19:06:26.184815	Classroom Activity	27544d16-ec5a-4529-85aa-42bd31868291
5f7da6d3-7531-4734-8de2-f4fe15f1a1b2	7c44d2b3-fc5b-4c56-8c3a-3879b2e5e52e	1	text	\N	\N	Simple EVS concepts for LKG: Animals and Homes with visuals, actions, and repetition.	2026-05-29 19:06:26.197012	2026-05-29 19:06:26.197012	Summary	\N
7e985dd9-ffe7-4cc2-8fea-63713d49441f	7c44d2b3-fc5b-4c56-8c3a-3879b2e5e52e	2	youtube_url	\N	https://www.youtube.com/watch?v=Iido68T4czc	\N	2026-05-29 19:06:26.197012	2026-05-29 19:06:26.197012	Watch & Learn 1	\N
9a086092-8298-4523-8883-638ddc00b502	7c44d2b3-fc5b-4c56-8c3a-3879b2e5e52e	3	youtube_url	\N	https://www.youtube.com/watch?v=dXZEye_gTSE	\N	2026-05-29 19:06:26.197012	2026-05-29 19:06:26.197012	Watch & Learn 2	\N
8e53d1e1-cc53-4361-96c3-9a08f9d31e9d	7c44d2b3-fc5b-4c56-8c3a-3879b2e5e52e	4	text	\N	\N	Show picture cards, ask children to answer by tapping, matching, and speaking.	2026-05-29 19:06:26.197012	2026-05-29 19:06:26.197012	Classroom Activity	a1b3d3c5-157f-4f6b-9eb8-9a4101f86b64
0721838d-72e0-409b-a19d-45ec680ab879	40e619d7-16e6-4e4b-b317-7bb22b86dc61	1	text	\N	\N	Simple EVS concepts for LKG: Plants and Helpers with visuals, actions, and repetition.	2026-05-29 19:06:26.207072	2026-05-29 19:06:26.207072	Summary	\N
0cba3535-ef1f-4096-858d-e0a02a12481a	40e619d7-16e6-4e4b-b317-7bb22b86dc61	2	youtube_url	\N	https://www.youtube.com/watch?v=A-xScqCN0GA	\N	2026-05-29 19:06:26.207072	2026-05-29 19:06:26.207072	Watch & Learn 1	\N
ef3f30eb-6ae7-48fa-ad00-836dc3980d03	40e619d7-16e6-4e4b-b317-7bb22b86dc61	3	youtube_url	\N	https://www.youtube.com/watch?v=BzzFRQsmb74	\N	2026-05-29 19:06:26.207072	2026-05-29 19:06:26.207072	Watch & Learn 2	\N
7c34040f-33a4-47b4-a0f7-a01b85c32bf4	40e619d7-16e6-4e4b-b317-7bb22b86dc61	4	text	\N	\N	Show picture cards, ask children to answer by tapping, matching, and speaking.	2026-05-29 19:06:26.207072	2026-05-29 19:06:26.207072	Classroom Activity	f1b6e4e0-169e-4f32-a796-bd3abfdb1265
df467c19-9219-4606-9343-c0af0beef77a	ae68c5a0-5714-45bf-b4e3-951af9c6af7d	1	text	\N	\N	Simple General Knowledge concepts for LKG: Colours and Objects with visuals, actions, and repetition.	2026-05-29 19:06:26.21735	2026-05-29 19:06:26.21735	Summary	\N
b1df24a8-ccc6-4d74-9438-30acfd9515a8	ae68c5a0-5714-45bf-b4e3-951af9c6af7d	2	youtube_url	\N	https://www.youtube.com/watch?v=zxIpA5nF_LY	\N	2026-05-29 19:06:26.21735	2026-05-29 19:06:26.21735	Watch & Learn 1	\N
a2765cee-24bd-46f3-9c85-92ba6c04a158	ae68c5a0-5714-45bf-b4e3-951af9c6af7d	3	youtube_url	\N	https://www.youtube.com/watch?v=ybt2jhCQ3lA	\N	2026-05-29 19:06:26.21735	2026-05-29 19:06:26.21735	Watch & Learn 2	\N
ca83c10b-d2f8-4b81-8daa-56db3856491b	ae68c5a0-5714-45bf-b4e3-951af9c6af7d	4	text	\N	\N	Show picture cards, ask children to answer by tapping, matching, and speaking.	2026-05-29 19:06:26.21735	2026-05-29 19:06:26.21735	Classroom Activity	87da913a-7c5f-4b8c-9b05-ba8589a8c745
1f655616-caa0-4d04-917d-3a379bbdb265	06ecf78f-2563-4e8e-816a-8f42188f18ef	1	text	\N	\N	Simple General Knowledge concepts for LKG: Transport and Festivals with visuals, actions, and repetition.	2026-05-29 19:06:26.22573	2026-05-29 19:06:26.22573	Summary	\N
118c3b80-1e54-4c90-9946-3d1e73ae0ad9	06ecf78f-2563-4e8e-816a-8f42188f18ef	2	youtube_url	\N	https://www.youtube.com/watch?v=zxIpA5nF_LY	\N	2026-05-29 19:06:26.22573	2026-05-29 19:06:26.22573	Watch & Learn 1	\N
771b74b3-ff97-4374-ac15-b3dc3d5c58a6	06ecf78f-2563-4e8e-816a-8f42188f18ef	3	youtube_url	\N	https://www.youtube.com/watch?v=NYLHPHOVqek	\N	2026-05-29 19:06:26.22573	2026-05-29 19:06:26.22573	Watch & Learn 2	\N
9562cd7a-819b-4a97-8b21-6e91240686c2	06ecf78f-2563-4e8e-816a-8f42188f18ef	4	text	\N	\N	Show picture cards, ask children to answer by tapping, matching, and speaking.	2026-05-29 19:06:26.22573	2026-05-29 19:06:26.22573	Classroom Activity	9675eec6-48bd-4f79-a82f-43b112d81259
9cb3a697-dfdf-45d7-8165-221ff5fd3547	9977430e-9123-4751-8327-024d456e896a	1	text	\N	\N	Simple Moral Values concepts for LKG: Sharing and Caring with visuals, actions, and repetition.	2026-05-29 19:06:26.235363	2026-05-29 19:06:26.235363	Summary	\N
4d60805f-3006-433b-af2a-aa0523c0da6a	9977430e-9123-4751-8327-024d456e896a	2	youtube_url	\N	https://www.youtube.com/watch?v=hVT-BXw4hEM	\N	2026-05-29 19:06:26.235363	2026-05-29 19:06:26.235363	Watch & Learn 1	\N
85146b56-2752-4fc9-8cf1-f0e077b5b5c8	9977430e-9123-4751-8327-024d456e896a	3	youtube_url	\N	https://www.youtube.com/watch?v=FRm-_kt_osY	\N	2026-05-29 19:06:26.235363	2026-05-29 19:06:26.235363	Watch & Learn 2	\N
67149c47-966d-40a2-b1c5-de82109c6083	9977430e-9123-4751-8327-024d456e896a	4	text	\N	\N	Show picture cards, ask children to answer by tapping, matching, and speaking.	2026-05-29 19:06:26.235363	2026-05-29 19:06:26.235363	Classroom Activity	319442dd-0644-4dad-bb71-cf055cafc3d4
c22f57c6-ff81-431f-ada8-e729880a2d56	ebd5a137-e809-4c2a-bf2f-ae06f7862eea	1	text	\N	\N	Simple Moral Values concepts for LKG: Honesty and Respect with visuals, actions, and repetition.	2026-05-29 19:06:26.244071	2026-05-29 19:06:26.244071	Summary	\N
ccac662e-ff24-493f-aba6-26d212aa7c11	ebd5a137-e809-4c2a-bf2f-ae06f7862eea	2	youtube_url	\N	https://www.youtube.com/watch?v=BGlHu7gufhc	\N	2026-05-29 19:06:26.244071	2026-05-29 19:06:26.244071	Watch & Learn 1	\N
640f2b7e-0b28-4751-9f1f-7f548f9b46b2	ebd5a137-e809-4c2a-bf2f-ae06f7862eea	3	youtube_url	\N	https://www.youtube.com/watch?v=EM7URPzyjRY	\N	2026-05-29 19:06:26.244071	2026-05-29 19:06:26.244071	Watch & Learn 2	\N
c501fa53-c3a2-448c-8723-e69b81ff5f47	ebd5a137-e809-4c2a-bf2f-ae06f7862eea	4	text	\N	\N	Show picture cards, ask children to answer by tapping, matching, and speaking.	2026-05-29 19:06:26.244071	2026-05-29 19:06:26.244071	Classroom Activity	45578aba-3bad-41e4-bbf3-c7a3de764105
\.


--
-- Data for Name: learning_contents; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.learning_contents (id, organization_id, class_level, subject, title, content_type, media_url, external_url, text_content, created_by, created_at, updated_at, is_global) FROM stdin;
b9947905-fc92-41ab-b571-d89a3dd659a3	8ba8388f-9907-486c-9883-3784c2f2f34e	1	English	Introduction to Naming Words	text	\N	\N	A noun is a naming word. It names a person, place, animal, or thing. Examples: Boy (person), School (place), Dog (animal), Toy (thing).	\N	2026-05-21 17:32:02.260981	2026-05-21 17:48:03.395217	f
e5c35d8a-3493-4f72-acd6-e4d4b44b8ae1	8ba8388f-9907-486c-9883-3784c2f2f34e	1	English	Phonics Audio Practice	audio	/media/bg-audio/eliveta-kids-happy-music-474162.mp3	\N	Listen to the sounds of the letters and repeat them aloud.	\N	2026-05-21 17:32:02.259811	2026-05-21 17:48:20.07092	f
f316f4c9-8b8f-4cc7-a99f-b593fa1fb02c	8ba8388f-9907-486c-9883-3784c2f2f34e	1	English	Action Words (Verbs)	multi_section	\N	\N	Action words tell us what someone or something is doing. Examples: run, jump, read, write, play, sleep.	\N	2026-05-21 17:32:02.261945	2026-05-21 17:49:26.845388	f
fc7d17ac-33b7-4530-9cd8-45c1176eb760	8ba8388f-9907-486c-9883-3784c2f2f34e	1	English	Interactive Phonics Guide-HCM	text	\N	\N	Welcome to Phonics! Let's learn the sounds of English letters. 'A' says /æ/ as in Apple. 'B' says /b/ as in Ball. 'C' says /k/ as in Cat.	\N	2026-05-21 17:32:02.25782	2026-05-21 17:32:02.25782	f
040dc8a2-5469-4346-b196-60869396865b	8ba8388f-9907-486c-9883-3784c2f2f34e	3	Hindi Stories	पंचतंत्र कहानियाँ - Best Collection	video	\N	https://www.youtube.com/watch?v=gu6DgzoiyK0	सबसे लोकप्रिय पंचतंत्र कहानियों का संग्रह।	866bc022-307f-4218-94a3-7622dd2aec79	2026-05-22 13:56:44.431485	2026-05-22 13:56:44.431485	f
853aa843-81a1-4b3f-b6e6-4b63647d805a	8ba8388f-9907-486c-9883-3784c2f2f34e	3	Hindi Stories	Panchatantra Stories - Mocomi Hindi	video	\N	https://www.youtube.com/watch?v=bLtpRbWQ8zQ	मोकोमी द्वारा पंचतंत्र की नैतिक कहानियाँ।	866bc022-307f-4218-94a3-7622dd2aec79	2026-05-22 13:56:44.431485	2026-05-22 13:56:44.431485	f
649a210b-0d22-4443-b88a-f67af0d0e6a9	8ba8388f-9907-486c-9883-3784c2f2f34e	3	Hindi Stories	Best of Panchatantra - Magic Box	video	\N	https://www.youtube.com/watch?v=IqBS_mNqKkY	मैजिक बॉक्स द्वारा पंचतंत्र की श्रेष्ठ कहानियाँ।	866bc022-307f-4218-94a3-7622dd2aec79	2026-05-22 13:56:44.431485	2026-05-22 13:56:44.431485	f
85bb8d1f-b2d3-4e99-b413-ef234271815d	8ba8388f-9907-486c-9883-3784c2f2f34e	3	Hindi Stories	9 पंचतंत्र कहानियाँ - Shivi TV	video	\N	https://www.youtube.com/watch?v=HrgNzcPT-d0	शिवि टीवी पर 9 बेहतरीन पंचतंत्र कहानियाँ।	866bc022-307f-4218-94a3-7622dd2aec79	2026-05-22 13:56:44.431485	2026-05-22 13:56:44.431485	f
3240ae39-f4c9-47a1-bcc1-f42abfe35f4b	8ba8388f-9907-486c-9883-3784c2f2f34e	3	Hindi Stories	पंचतंत्र की कहानियाँ - Jungle TV	video	\N	https://www.youtube.com/watch?v=Sv3ts-ARuHc	जंगल टीवी पर पंचतंत्र की मनोरंजक कहानियाँ।	866bc022-307f-4218-94a3-7622dd2aec79	2026-05-22 13:56:44.431485	2026-05-22 13:56:44.431485	f
e35b7086-c0d9-43bc-a61b-5d96f10930f6	8ba8388f-9907-486c-9883-3784c2f2f34e	3	Hindi Stories	पंचतंत्र कहानियां - Hindi Cartoon	video	\N	https://www.youtube.com/watch?v=mD09Jd790ug	हिंदी कार्टून में पंचतंत्र की रोमांचक कहानियाँ।	866bc022-307f-4218-94a3-7622dd2aec79	2026-05-22 13:56:44.431485	2026-05-22 13:56:44.431485	f
1974f419-c86e-4cfe-8a18-60f6b504390d	8ba8388f-9907-486c-9883-3784c2f2f34e	3	Hindi Stories	शेर और चूहा - Lion and Mouse	video	\N	https://www.youtube.com/watch?v=0X2zBBCFiME	शेर और चूहे की दोस्ती और सहायता की सीख।	866bc022-307f-4218-94a3-7622dd2aec79	2026-05-22 13:56:44.431485	2026-05-22 13:56:44.431485	f
2fb51f06-96e1-4646-96a0-75d0df187c83	8ba8388f-9907-486c-9883-3784c2f2f34e	3	Hindi Stories	कौवा और लोमड़ी - Crow and Fox	video	\N	https://www.youtube.com/watch?v=0RCGxJpXoaA	चालाक लोमड़ी और मूर्ख कौवे की कहानी।	866bc022-307f-4218-94a3-7622dd2aec79	2026-05-22 13:56:44.431485	2026-05-22 13:56:44.431485	f
3295472b-08a3-4b2f-a5a9-116e3dd929a0	8ba8388f-9907-486c-9883-3784c2f2f34e	3	Hindi Stories	बंदर और मगरमच्छ - Monkey & Croc	video	\N	https://www.youtube.com/watch?v=WV2a2-AqNwQ	समझदारी से खतरे से बचने की कहानी।	866bc022-307f-4218-94a3-7622dd2aec79	2026-05-22 13:56:44.431485	2026-05-22 13:56:44.431485	f
3c7e9162-e94e-488f-96a4-cf59b3453cc8	8ba8388f-9907-486c-9883-3784c2f2f34e	3	Hindi Stories	खरगोश और कछुआ - Hare and Tortoise	video	\N	https://www.youtube.com/watch?v=GvS1i7bfxeY	धीरे लेकिन लगातार चलने वाला जीतता है।	866bc022-307f-4218-94a3-7622dd2aec79	2026-05-22 13:56:44.431485	2026-05-22 13:56:44.431485	f
dd18c8fc-ca59-45e9-a02d-4cd78023f928	8ba8388f-9907-486c-9883-3784c2f2f34e	3	Hindi Stories	hindi story content 1	multi_section	\N	https://www.youtube.com/watch?v=KxSEYA04Rvg&list=PLsWoRuvTLq-1ALHPvkvwHBZHkNAEPFYxb&index=2	\N	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	2026-05-22 15:40:37.163053	2026-05-22 15:40:37.163053	f
1979094b-6526-4aa9-a6e4-1790467adfae	8ba8388f-9907-486c-9883-3784c2f2f34e	3	Hindi Stories	Dev aur Vahan	image	https://gathjod-emeelan.s3.ap-southeast-2.amazonaws.com/els-media/8ba8388f-9907-486c-9883-3784c2f2f34e/video/2026/05/e852967f-713b-485b-9f88-9bf084a01cc8-god_vehical.mp4	\N	\N	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	2026-05-24 17:39:48.744472	2026-05-24 17:40:13.208713	f
40e619d7-16e6-4e4b-b317-7bb22b86dc61	8ba8388f-9907-486c-9883-3784c2f2f34e	LKG	EVS	Plants and Helpers	multi_section	\N	\N	Simple EVS concepts for LKG: Plants and Helpers with visuals, actions, and repetition.	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	2026-05-29 18:37:16.668494	2026-05-29 19:06:26.207072	f
ae68c5a0-5714-45bf-b4e3-951af9c6af7d	8ba8388f-9907-486c-9883-3784c2f2f34e	LKG	General Knowledge	Colours and Objects	multi_section	\N	\N	Simple General Knowledge concepts for LKG: Colours and Objects with visuals, actions, and repetition.	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	2026-05-29 18:37:17.902544	2026-05-29 19:06:26.21735	f
06ecf78f-2563-4e8e-816a-8f42188f18ef	8ba8388f-9907-486c-9883-3784c2f2f34e	LKG	General Knowledge	Transport and Festivals	multi_section	\N	\N	Simple General Knowledge concepts for LKG: Transport and Festivals with visuals, actions, and repetition.	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	2026-05-29 18:37:19.141599	2026-05-29 19:06:26.22573	f
9977430e-9123-4751-8327-024d456e896a	8ba8388f-9907-486c-9883-3784c2f2f34e	LKG	Moral Values	Sharing and Caring	multi_section	\N	\N	Simple Moral Values concepts for LKG: Sharing and Caring with visuals, actions, and repetition.	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	2026-05-29 18:37:20.372749	2026-05-29 19:06:26.235363	f
ebd5a137-e809-4c2a-bf2f-ae06f7862eea	8ba8388f-9907-486c-9883-3784c2f2f34e	LKG	Moral Values	Honesty and Respect	multi_section	\N	\N	Simple Moral Values concepts for LKG: Honesty and Respect with visuals, actions, and repetition.	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	2026-05-29 18:37:21.604321	2026-05-29 19:06:26.244071	f
9b7d9a5d-b665-48f7-8924-7f4b5478eaa9	8ba8388f-9907-486c-9883-3784c2f2f34e	LKG	Mathematics	Numbers and Counting	multi_section	\N	\N	Simple Mathematics concepts for LKG: Numbers and Counting with visuals, actions, and repetition.	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	2026-05-29 18:37:10.49004	2026-05-29 19:06:26.13386	f
0f25e529-1cb5-49f5-9671-8463f08de3c2	8ba8388f-9907-486c-9883-3784c2f2f34e	LKG	Mathematics	Shapes and Comparison	multi_section	\N	\N	Simple Mathematics concepts for LKG: Shapes and Comparison with visuals, actions, and repetition.	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	2026-05-29 18:37:11.730132	2026-05-29 19:06:26.15468	f
bebf531e-d4ae-471f-9b81-d25ecdca02ac	8ba8388f-9907-486c-9883-3784c2f2f34e	LKG	English	Alphabet and Phonics	multi_section	\N	\N	Simple English concepts for LKG: Alphabet and Phonics with visuals, actions, and repetition.	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	2026-05-29 18:37:12.963206	2026-05-29 19:06:26.1703	f
1dd3f060-2a1f-4b5a-b766-917dffc898bd	8ba8388f-9907-486c-9883-3784c2f2f34e	LKG	English	Simple Words	multi_section	\N	\N	Simple English concepts for LKG: Simple Words with visuals, actions, and repetition.	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	2026-05-29 18:37:14.196854	2026-05-29 19:06:26.184815	f
7c44d2b3-fc5b-4c56-8c3a-3879b2e5e52e	8ba8388f-9907-486c-9883-3784c2f2f34e	LKG	EVS	Animals and Homes	multi_section	\N	\N	Simple EVS concepts for LKG: Animals and Homes with visuals, actions, and repetition.	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	2026-05-29 18:37:15.437803	2026-05-29 19:06:26.197012	f
\.


--
-- Data for Name: notification_preferences; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.notification_preferences (user_id, organization_id, enabled_types, auto_delete_days, updated_at) FROM stdin;
\.


--
-- Data for Name: notification_schedules; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.notification_schedules (id, classroom_id, organization_id, trigger_type, fire_at, status, payload, created_at) FROM stdin;
\.


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.notifications (id, user_id, organization_id, type, category, title, message, status, cta_label, cta_route, metadata, source_event_id, parent_notification_id, created_at, read_at, expiry_at, deleted_at) FROM stdin;
9aa20085-c50d-4aa5-9b57-08d5d8237175	ff0c234b-4d70-4a86-bce2-b88ce5e0d71e	8ba8388f-9907-486c-9883-3784c2f2f34e	CLASS_ENDED	classroom	Class ended	Great job — everything in "CLASS 1" has been submitted.	unread	View Class	/classroom/d782e15c-4b05-453a-ba8b-fd8f313263ab	{"classroomId": "d782e15c-4b05-453a-ba8b-fd8f313263ab", "pendingQuizzes": [], "pendingAssignments": []}	2beef4c5-f091-4831-b481-4179d4351057	\N	2026-05-27 23:54:20.596418+05:30	\N	2026-06-01 23:54:20.596418+05:30	\N
5c57a080-aab9-44b9-ac0e-5a3c155b7509	ff0c234b-4d70-4a86-bce2-b88ce5e0d71e	8ba8388f-9907-486c-9883-3784c2f2f34e	CLASS_ENDED	classroom	Class ended	Great job — everything in "CLASS 1" has been submitted.	unread	View Class	/(tabs)/classroom	{"classroomId": "d782e15c-4b05-453a-ba8b-fd8f313263ab", "pendingQuizzes": [], "pendingAssignments": []}	8c80d2a6-e523-411c-8ec3-6286aa1e4a87	\N	2026-05-28 00:19:59.8757+05:30	\N	2026-06-02 00:19:59.8757+05:30	\N
954f61dc-98a5-423d-8e7d-310369ca4415	fe400696-c6f1-4122-b97e-c7f825f39d25	8ba8388f-9907-486c-9883-3784c2f2f34e	CLASS_ENDED	classroom	Class ended	Great job — everything in "CLASS 1" has been submitted.	unread	View Class	/(tabs)/classroom	{"classroomId": "d782e15c-4b05-453a-ba8b-fd8f313263ab", "pendingQuizzes": [], "pendingAssignments": []}	8c80d2a6-e523-411c-8ec3-6286aa1e4a87	\N	2026-05-28 00:19:58.938422+05:30	\N	2026-06-02 00:19:58.938422+05:30	2026-05-28 00:20:16.034312+05:30
74401dc4-2658-4d1a-89ad-4eb00dab7076	fe400696-c6f1-4122-b97e-c7f825f39d25	8ba8388f-9907-486c-9883-3784c2f2f34e	CLASS_ENDED	classroom	Class ended	Great job — everything in "CLASS 1" has been submitted.	read	View Class	/classroom/d782e15c-4b05-453a-ba8b-fd8f313263ab	{"classroomId": "d782e15c-4b05-453a-ba8b-fd8f313263ab", "pendingQuizzes": [], "pendingAssignments": []}	2beef4c5-f091-4831-b481-4179d4351057	\N	2026-05-27 23:54:19.906372+05:30	2026-05-27 23:54:39.825074+05:30	2026-06-01 23:54:19.906372+05:30	2026-05-28 00:20:22.506381+05:30
b0962fbc-3b9c-4b4e-a37c-aeb77223b3ed	fe400696-c6f1-4122-b97e-c7f825f39d25	8ba8388f-9907-486c-9883-3784c2f2f34e	CLASS_LIVE	classroom	Class ended	CLASS 1 is starting now. Tap to join.	read	\N	\N	{"startTime": null, "classroomId": "d782e15c-4b05-453a-ba8b-fd8f313263ab"}	b989b254-f60a-481c-a4b0-cbed7aa1ffca	\N	2026-05-27 23:49:02.078203+05:30	2026-05-27 23:49:08.323618+05:30	2026-06-01 23:49:02.078203+05:30	2026-05-28 00:20:22.862041+05:30
5c94053b-d1f3-4a4a-8763-1c5720696b1f	ff0c234b-4d70-4a86-bce2-b88ce5e0d71e	8ba8388f-9907-486c-9883-3784c2f2f34e	CLASS_RESTARTED	classroom	Class restarted — join now	CLASS 1 has been restarted by your teacher. Tap Join to rejoin.	unread	Join Class	/(tabs)/classroom	{"isRestart": true, "startTime": null, "classroomId": "d782e15c-4b05-453a-ba8b-fd8f313263ab"}	e9535946-0212-426b-8257-3d3155edb509	\N	2026-05-28 00:22:59.88425+05:30	\N	2026-06-02 00:22:59.88425+05:30	\N
7ee5546a-dce6-4609-99de-d8615c6ee514	ff0c234b-4d70-4a86-bce2-b88ce5e0d71e	8ba8388f-9907-486c-9883-3784c2f2f34e	CLASS_LIVE	classroom	Class ended	my Class 1 Classroom is starting now. Tap to join.	read	\N	\N	{"expired": true, "isRestart": false, "startTime": null, "classroomId": "ad95dafa-d5ec-49cb-aeb0-5189487e7d25", "expiredReason": "ended"}	247388e5-272f-42ec-b7c5-da46f7b3025c	\N	2026-05-28 13:47:06.570884+05:30	2026-05-28 13:48:34.593498+05:30	2026-06-02 13:47:06.570884+05:30	\N
0d118d5d-1229-452a-8d62-8b37e3ac26d2	ff0c234b-4d70-4a86-bce2-b88ce5e0d71e	8ba8388f-9907-486c-9883-3784c2f2f34e	CLASS_LIVE	classroom	Class ended	CLASS 1 is starting now. Tap to join.	read	\N	\N	{"startTime": null, "classroomId": "d782e15c-4b05-453a-ba8b-fd8f313263ab"}	b989b254-f60a-481c-a4b0-cbed7aa1ffca	\N	2026-05-27 23:49:02.649868+05:30	2026-05-28 00:19:57.81381+05:30	2026-06-01 23:49:02.649868+05:30	\N
09ec538f-1929-42fa-b2eb-bb79d2ef8a0b	ff0c234b-4d70-4a86-bce2-b88ce5e0d71e	8ba8388f-9907-486c-9883-3784c2f2f34e	CLASS_ENDED	classroom	Class ended	Great job — everything in "CLASS 1" has been submitted.	unread	View Class	/(tabs)/classroom	{"classroomId": "d782e15c-4b05-453a-ba8b-fd8f313263ab", "pendingQuizzes": [], "pendingAssignments": []}	eda5b556-e4a0-4b09-9764-f3e87ef993b1	\N	2026-05-28 00:24:53.114204+05:30	\N	2026-06-02 00:24:53.114204+05:30	\N
24e77d0d-4e9a-4290-8ea1-05fcb15fda99	fe400696-c6f1-4122-b97e-c7f825f39d25	8ba8388f-9907-486c-9883-3784c2f2f34e	CLASS_ENDED	classroom	Class ended	Great job — everything in "CLASS 1" has been submitted.	read	View Class	/(tabs)/classroom	{"classroomId": "d782e15c-4b05-453a-ba8b-fd8f313263ab", "pendingQuizzes": [], "pendingAssignments": []}	eda5b556-e4a0-4b09-9764-f3e87ef993b1	\N	2026-05-28 00:24:52.115763+05:30	2026-05-28 00:31:26.347583+05:30	2026-06-02 00:24:52.115763+05:30	2026-05-28 00:31:33.349225+05:30
9fecd5fc-609b-418d-b607-46039e4f24af	fe400696-c6f1-4122-b97e-c7f825f39d25	8ba8388f-9907-486c-9883-3784c2f2f34e	CLASS_RESTARTED	classroom	Class restarted — join now	CLASS 1 has been restarted by your teacher. Tap Join to rejoin.	read	Join Class	/(tabs)/classroom	{"isRestart": true, "startTime": null, "classroomId": "d782e15c-4b05-453a-ba8b-fd8f313263ab"}	e9535946-0212-426b-8257-3d3155edb509	\N	2026-05-28 00:22:59.239341+05:30	2026-05-28 00:23:08.028283+05:30	2026-06-02 00:22:59.239341+05:30	2026-05-28 00:31:33.762701+05:30
1777d4ae-cad0-4d65-a6ac-5a72d789d356	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	8ba8388f-9907-486c-9883-3784c2f2f34e	CLASS_ENDED	classroom	Class ended	Your child has completed all work for "CLASS 1".	read	View Class	/(tabs)/classroom	{"classroomId": "d782e15c-4b05-453a-ba8b-fd8f313263ab", "studentUserId": "fe400696-c6f1-4122-b97e-c7f825f39d25", "pendingQuizzes": 0, "pendingAssignments": 0}	eda5b556-e4a0-4b09-9764-f3e87ef993b1	\N	2026-05-28 00:24:52.609845+05:30	2026-05-28 00:32:37.052356+05:30	2026-06-02 00:24:52.609845+05:30	2026-05-28 00:32:38.317927+05:30
09d7e077-b98d-4141-aa78-0ea021386792	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	8ba8388f-9907-486c-9883-3784c2f2f34e	CLASS_RESTARTED	classroom	Your child's class has restarted	CLASS 1 has been restarted by the teacher.	read	Join Class	/(tabs)/classroom	{"isRestart": true, "classroomId": "d782e15c-4b05-453a-ba8b-fd8f313263ab", "studentUserId": "fe400696-c6f1-4122-b97e-c7f825f39d25"}	e9535946-0212-426b-8257-3d3155edb509	\N	2026-05-28 00:22:59.292298+05:30	2026-05-28 00:23:37.864737+05:30	2026-06-02 00:22:59.292298+05:30	2026-05-28 00:32:38.518177+05:30
9fcf1b95-d9d3-42e3-8052-7cbc492b7be1	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	8ba8388f-9907-486c-9883-3784c2f2f34e	CLASS_ENDED	classroom	Class ended	Your child has completed all work for "CLASS 1".	read	View Class	/(tabs)/classroom	{"classroomId": "d782e15c-4b05-453a-ba8b-fd8f313263ab", "studentUserId": "fe400696-c6f1-4122-b97e-c7f825f39d25", "pendingQuizzes": 0, "pendingAssignments": 0}	8c80d2a6-e523-411c-8ec3-6286aa1e4a87	\N	2026-05-28 00:19:59.374016+05:30	2026-05-28 00:22:11.411887+05:30	2026-06-02 00:19:59.374016+05:30	2026-05-28 00:32:38.699117+05:30
d9e289b2-a201-418b-830c-6046c94b443b	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	8ba8388f-9907-486c-9883-3784c2f2f34e	CLASS_ENDED	classroom	Class ended	Your child has completed all work for "CLASS 1".	read	View Class	/classroom/d782e15c-4b05-453a-ba8b-fd8f313263ab	{"classroomId": "d782e15c-4b05-453a-ba8b-fd8f313263ab", "studentUserId": "fe400696-c6f1-4122-b97e-c7f825f39d25", "pendingQuizzes": 0, "pendingAssignments": 0}	2beef4c5-f091-4831-b481-4179d4351057	\N	2026-05-27 23:54:20.064346+05:30	2026-05-28 00:22:13.551934+05:30	2026-06-01 23:54:20.064346+05:30	2026-05-28 00:32:38.911015+05:30
e16dbe4d-bc12-402d-836d-ad8aad8729f3	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	8ba8388f-9907-486c-9883-3784c2f2f34e	CLASS_LIVE	classroom	Class ended	CLASS 1.	read	\N	\N	{"classroomId": "d782e15c-4b05-453a-ba8b-fd8f313263ab", "studentUserId": "fe400696-c6f1-4122-b97e-c7f825f39d25"}	b989b254-f60a-481c-a4b0-cbed7aa1ffca	\N	2026-05-27 23:49:02.149574+05:30	2026-05-28 00:19:57.81381+05:30	2026-06-01 23:49:02.149574+05:30	2026-05-28 00:32:39.101793+05:30
46b40e10-477e-494c-a1d8-c9bea88346ff	fe400696-c6f1-4122-b97e-c7f825f39d25	8ba8388f-9907-486c-9883-3784c2f2f34e	CLASS_ENDED_PENDING	classroom	Class ended — finish your work	Class "Class 1 English Morning Session" has ended. Please finish and submit 1 assignment before the deadline.	read	Submit Now	/(tabs)/classroom	{"classroomId": "540f0a55-8239-42bc-9465-8329541854c7", "pendingQuizzes": [], "pendingAssignments": [{"id": "5eebd266-8d17-4b16-996e-be2fdea92937", "title": "Alphabet Practice Worksheet"}]}	10fa2390-4e75-40e0-8ea0-b0e6d03a79fd	\N	2026-05-28 00:31:44.149484+05:30	2026-05-28 00:31:47.58788+05:30	2026-06-02 00:31:44.149484+05:30	2026-05-28 00:44:48.534457+05:30
22940df9-db04-4570-8924-18c2e96643a9	fe400696-c6f1-4122-b97e-c7f825f39d25	8ba8388f-9907-486c-9883-3784c2f2f34e	CLASS_RESTARTED	classroom	Class restarted — join now	my Class 1 Classroom has been restarted by your teacher. Tap Join to rejoin.	read	Join Class	/(tabs)/classroom	{"isRestart": true, "startTime": null, "classroomId": "ad95dafa-d5ec-49cb-aeb0-5189487e7d25"}	dd0f565e-5845-4b67-b125-88d4547308e1	\N	2026-05-28 13:49:12.564082+05:30	2026-05-28 13:49:24.142148+05:30	2026-06-02 13:49:12.564082+05:30	2026-05-28 14:06:28.781419+05:30
6f6930f4-d8f2-462d-80ef-17e1fb70d28f	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	8ba8388f-9907-486c-9883-3784c2f2f34e	CLASS_RESTARTED	classroom	Your child's class has restarted	my Class 1 Classroom has been restarted by the teacher.	read	\N	\N	{"audience": "parent", "isRestart": true, "classroomId": "ad95dafa-d5ec-49cb-aeb0-5189487e7d25", "studentUserId": "fe400696-c6f1-4122-b97e-c7f825f39d25"}	dd0f565e-5845-4b67-b125-88d4547308e1	\N	2026-05-28 13:49:12.62763+05:30	2026-05-28 13:49:53.843861+05:30	2026-06-02 13:49:12.62763+05:30	2026-05-28 20:15:10.877295+05:30
4bc58fb3-d551-446f-b396-543a0504aca0	ff0c234b-4d70-4a86-bce2-b88ce5e0d71e	8ba8388f-9907-486c-9883-3784c2f2f34e	CLASS_ENDED_PENDING	classroom	Class ended — finish your work	Class "Class 1 English Morning Session" has ended. Please finish and submit 3 quizzes and 1 assignment before the deadline.	unread	Submit Now	/(tabs)/classroom	{"classroomId": "540f0a55-8239-42bc-9465-8329541854c7", "pendingQuizzes": [{"id": "99f27629-ef10-4db4-badc-fcc19496503d", "title": "Nouns & Naming Words Quiz"}, {"id": "42848837-bd7f-4e3b-b558-2b2805b16192", "title": "Simple Action Words Quiz"}, {"id": "f85700b3-faa3-4042-b8c4-c78a31a39610", "title": "Class 1 English: Comprehensive Master Quiz"}], "pendingAssignments": [{"id": "5eebd266-8d17-4b16-996e-be2fdea92937", "title": "Alphabet Practice Worksheet"}]}	10fa2390-4e75-40e0-8ea0-b0e6d03a79fd	\N	2026-05-28 00:31:44.79424+05:30	\N	2026-06-02 00:31:44.79424+05:30	\N
6cacb57a-b19b-4adb-903d-df5d6098182c	ff0c234b-4d70-4a86-bce2-b88ce5e0d71e	8ba8388f-9907-486c-9883-3784c2f2f34e	CLASS_RESTARTED	classroom	Class restarted — join now	Class 1 English Morning Session has been restarted by your teacher. Tap Join to rejoin.	unread	Join Class	/(tabs)/classroom	{"isRestart": true, "startTime": null, "classroomId": "540f0a55-8239-42bc-9465-8329541854c7"}	8bf1aed2-e911-4ebb-b54d-497448d7ec8b	\N	2026-05-28 00:31:57.519936+05:30	\N	2026-06-02 00:31:57.519936+05:30	\N
6c5fb09c-ec2e-48a0-b5ac-92a341411ac0	866bc022-307f-4218-94a3-7622dd2aec79	8ba8388f-9907-486c-9883-3784c2f2f34e	STUDENT_ACTIVITY	classroom	New activity in "Class 1 Classroom"	1 quiz from 1 student.	read	Open Class	/(tabs)/classroom	{"counts": {"quiz": 1, "assignment": 0}, "lastAt": "2026-05-27T19:04:38.578Z", "audience": "teacher", "students": ["fe400696-c6f1-4122-b97e-c7f825f39d25"], "classroomId": "1e77a495-0570-417b-a216-7da3ebb7d6d6", "classroomTitle": "Class 1 Classroom", "lastActivityKind": "quiz_submitted", "lastStudentUserId": "fe400696-c6f1-4122-b97e-c7f825f39d25"}	a46cf135-9efb-42dc-b862-ab02fda24f31	\N	2026-05-28 00:34:38.57923+05:30	2026-05-29 16:46:49.450925+05:30	2026-06-02 00:34:38.57923+05:30	2026-05-29 16:46:50.487548+05:30
6036ba93-d8e8-4314-ae99-0fbb6101020a	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	8ba8388f-9907-486c-9883-3784c2f2f34e	CLASS_RESTARTED	classroom	Your child's class has restarted	Class 1 English Morning Session has been restarted by the teacher.	read	\N	\N	{"audience": "parent", "isRestart": true, "classroomId": "540f0a55-8239-42bc-9465-8329541854c7", "studentUserId": "fe400696-c6f1-4122-b97e-c7f825f39d25"}	8bf1aed2-e911-4ebb-b54d-497448d7ec8b	\N	2026-05-28 00:31:57.01388+05:30	2026-05-28 00:32:37.052356+05:30	2026-06-02 00:31:57.01388+05:30	2026-05-28 00:32:37.920564+05:30
c6eecd28-e538-4ad3-a1be-008c73b9ec8b	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	8ba8388f-9907-486c-9883-3784c2f2f34e	CLASS_ENDED_PENDING	classroom	Your child has pending work	Your child has 0 pending quizzes and 1 pending assignment for "Class 1 English Morning Session".	read	\N	\N	{"audience": "parent", "classroomId": "540f0a55-8239-42bc-9465-8329541854c7", "studentUserId": "fe400696-c6f1-4122-b97e-c7f825f39d25", "pendingQuizzes": 0, "pendingAssignments": 1}	10fa2390-4e75-40e0-8ea0-b0e6d03a79fd	\N	2026-05-28 00:31:44.205043+05:30	2026-05-28 00:32:37.052356+05:30	2026-06-02 00:31:44.205043+05:30	2026-05-28 00:32:38.118718+05:30
fec9c31c-0a13-46f3-a967-3ea5dbed6c1f	fe400696-c6f1-4122-b97e-c7f825f39d25	8ba8388f-9907-486c-9883-3784c2f2f34e	CLASS_RESTARTED	classroom	Class restarted — join now	Class 1 English Morning Session has been restarted by your teacher. Tap Join to rejoin.	read	Join Class	/(tabs)/classroom	{"isRestart": true, "startTime": null, "classroomId": "540f0a55-8239-42bc-9465-8329541854c7"}	8bf1aed2-e911-4ebb-b54d-497448d7ec8b	\N	2026-05-28 00:31:56.956725+05:30	2026-05-28 00:32:06.1841+05:30	2026-06-02 00:31:56.956725+05:30	2026-05-28 00:44:48.534457+05:30
4e95051f-d042-49d8-9fb7-7fff8c70f6c6	fe400696-c6f1-4122-b97e-c7f825f39d25	8ba8388f-9907-486c-9883-3784c2f2f34e	REMARK_RECEIVED	remark	New remark from teacher	yfyif	read	View Details	/(tabs)/reports	{"remarkId": "0a6cb9d4-954b-42cf-988f-04ec144fe12c", "classroomId": "540f0a55-8239-42bc-9465-8329541854c7"}	796f610d-0f28-488c-8c07-116e0a3e7006	\N	2026-05-28 00:36:41.115193+05:30	2026-05-28 00:36:51.826059+05:30	2026-06-02 00:36:41.115193+05:30	2026-05-28 00:44:48.534457+05:30
30f5bbd4-482b-409b-8dce-683fb51abc5d	ff0c234b-4d70-4a86-bce2-b88ce5e0d71e	8ba8388f-9907-486c-9883-3784c2f2f34e	CLASS_SCHEDULED	classroom	New class scheduled: ClaSS1	A new class has been scheduled for you.	unread	View Class	/(tabs)/classroom	{"isRestart": false, "startTime": "2026-05-27T19:37:00.000Z", "classroomId": "35de2e31-8a78-4e3b-952e-ab16fac1c731"}	15f48bd0-5bc3-4094-84f8-5ecaf917082c	\N	2026-05-28 01:06:20.976808+05:30	\N	2026-06-02 01:06:20.976808+05:30	\N
3fccb2de-81be-42aa-95a0-272d164f21b9	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	8ba8388f-9907-486c-9883-3784c2f2f34e	CHILD_ACTIVITY	classroom	Activity in "Class 1 Classroom"	Rahul Kumar completed 1 quiz.	read	\N	\N	{"counts": {"quiz": 1, "assignment": 0}, "lastAt": "2026-05-27T19:04:38.519Z", "audience": "parent", "students": ["fe400696-c6f1-4122-b97e-c7f825f39d25"], "classroomId": "1e77a495-0570-417b-a216-7da3ebb7d6d6", "classroomTitle": "Class 1 Classroom", "lastActivityKind": "quiz_submitted", "lastStudentUserId": "fe400696-c6f1-4122-b97e-c7f825f39d25"}	a46cf135-9efb-42dc-b862-ab02fda24f31	\N	2026-05-28 00:34:38.520069+05:30	2026-05-28 00:35:46.10708+05:30	2026-06-02 00:34:38.520069+05:30	2026-05-28 13:47:46.824855+05:30
65f6c425-66c1-43a9-ab6c-79b20626ffe7	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	8ba8388f-9907-486c-9883-3784c2f2f34e	REMARK_RECEIVED	remark	Teacher remark for your child	yfyif	read	View Details	/(tabs)/reports	{"remarkId": "0a6cb9d4-954b-42cf-988f-04ec144fe12c", "classroomId": "540f0a55-8239-42bc-9465-8329541854c7", "studentUserId": "fe400696-c6f1-4122-b97e-c7f825f39d25"}	796f610d-0f28-488c-8c07-116e0a3e7006	4e95051f-d042-49d8-9fb7-7fff8c70f6c6	2026-05-28 00:36:41.169978+05:30	2026-05-28 00:37:13.870064+05:30	2026-06-02 00:36:41.169978+05:30	2026-05-28 13:47:46.824855+05:30
ebb9e890-f612-4af4-bb64-d57d7d8e43e6	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	8ba8388f-9907-486c-9883-3784c2f2f34e	CLASS_SCHEDULED	classroom	Class scheduled for your child	ClaSS1 at 5/28/2026, 1:07:00 AM.	read	\N	\N	{"audience": "parent", "isRestart": false, "classroomId": "35de2e31-8a78-4e3b-952e-ab16fac1c731", "studentUserId": "fe400696-c6f1-4122-b97e-c7f825f39d25"}	15f48bd0-5bc3-4094-84f8-5ecaf917082c	\N	2026-05-28 01:06:20.45657+05:30	2026-05-28 01:11:13.529645+05:30	2026-06-02 01:06:20.45657+05:30	2026-05-28 13:47:46.824855+05:30
1af32c79-d671-4e31-8a19-592b8085009e	fe400696-c6f1-4122-b97e-c7f825f39d25	8ba8388f-9907-486c-9883-3784c2f2f34e	CLASS_SCHEDULED	classroom	New class scheduled: ClaSS1	A new class has been scheduled for you.	read	View Class	/(tabs)/classroom	{"isRestart": false, "startTime": "2026-05-27T19:37:00.000Z", "classroomId": "35de2e31-8a78-4e3b-952e-ab16fac1c731"}	15f48bd0-5bc3-4094-84f8-5ecaf917082c	\N	2026-05-28 01:06:20.384419+05:30	2026-05-28 01:06:32.505527+05:30	2026-06-02 01:06:20.384419+05:30	2026-05-28 14:06:29.497567+05:30
993c93a3-551d-4a4f-b207-9716e37244be	ff0c234b-4d70-4a86-bce2-b88ce5e0d71e	8ba8388f-9907-486c-9883-3784c2f2f34e	CLASS_ENDED	classroom	Class ended	Great job — everything in "my Class 1 Classroom" has been submitted.	unread	View Class	/(tabs)/classroom	{"classroomId": "ad95dafa-d5ec-49cb-aeb0-5189487e7d25", "pendingQuizzes": [], "pendingAssignments": []}	2b37d6b5-d1d6-44da-9893-7d239e358841	\N	2026-05-28 13:48:36.661652+05:30	\N	2026-06-02 13:48:36.661652+05:30	\N
d154c4f2-1e17-47f1-82c2-6dc5212be23d	fe400696-c6f1-4122-b97e-c7f825f39d25	8ba8388f-9907-486c-9883-3784c2f2f34e	CLASS_ENDED	classroom	Class ended	Great job — everything in "my Class 1 Classroom" has been submitted.	read	View Class	/(tabs)/classroom	{"classroomId": "ad95dafa-d5ec-49cb-aeb0-5189487e7d25", "pendingQuizzes": [], "pendingAssignments": []}	2b37d6b5-d1d6-44da-9893-7d239e358841	\N	2026-05-28 13:48:35.751687+05:30	2026-05-28 13:48:42.910176+05:30	2026-06-02 13:48:35.751687+05:30	2026-05-28 14:06:29.01683+05:30
3c3f6b69-ffde-406f-afd8-2f162e2264df	fe400696-c6f1-4122-b97e-c7f825f39d25	8ba8388f-9907-486c-9883-3784c2f2f34e	CLASS_LIVE	classroom	Class ended	my Class 1 Classroom is starting now. Tap to join.	read	\N	\N	{"expired": true, "isRestart": false, "startTime": null, "classroomId": "ad95dafa-d5ec-49cb-aeb0-5189487e7d25", "expiredReason": "ended"}	247388e5-272f-42ec-b7c5-da46f7b3025c	\N	2026-05-28 13:47:05.998789+05:30	2026-05-28 13:48:29.842818+05:30	2026-06-02 13:47:05.998789+05:30	2026-05-28 14:06:29.292323+05:30
d7d4c2fa-cb94-4e10-844f-e03730fd6aa3	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	8ba8388f-9907-486c-9883-3784c2f2f34e	CLASS_LIVE	classroom	Class ended	my Class 1 Classroom.	read	\N	\N	{"expired": true, "audience": "parent", "isRestart": false, "classroomId": "ad95dafa-d5ec-49cb-aeb0-5189487e7d25", "expiredReason": "ended", "studentUserId": "fe400696-c6f1-4122-b97e-c7f825f39d25"}	247388e5-272f-42ec-b7c5-da46f7b3025c	\N	2026-05-28 13:47:06.073013+05:30	2026-05-28 13:48:34.593498+05:30	2026-06-02 13:47:06.073013+05:30	2026-05-28 20:15:11.244398+05:30
dd618357-0964-406d-8d49-9446f3f4ffd4	ff0c234b-4d70-4a86-bce2-b88ce5e0d71e	8ba8388f-9907-486c-9883-3784c2f2f34e	CLASS_RESTARTED	classroom	Class restarted — join now	my Class 1 Classroom has been restarted by your teacher. Tap Join to rejoin.	unread	Join Class	/(tabs)/classroom	{"isRestart": true, "startTime": null, "classroomId": "ad95dafa-d5ec-49cb-aeb0-5189487e7d25"}	dd0f565e-5845-4b67-b125-88d4547308e1	\N	2026-05-28 13:49:13.21803+05:30	\N	2026-06-02 13:49:13.21803+05:30	\N
438a06de-3485-4c54-8c87-6e8edc492f12	ff0c234b-4d70-4a86-bce2-b88ce5e0d71e	8ba8388f-9907-486c-9883-3784c2f2f34e	STORY_LIVE	classroom	New story is live	New Story — Start now!	unread	Start Story	/story/65ccde55-0714-49a0-9df4-88ca6734223d	{"storyId": "65ccde55-0714-49a0-9df4-88ca6734223d", "audience": "student"}	c7cb9f2c-062e-44ac-88da-c9aef09eccc7	\N	2026-05-28 14:38:04.539015+05:30	\N	2026-06-02 14:38:04.539015+05:30	\N
39dc2192-8760-4063-a239-11d3ef5ed79a	fe400696-c6f1-4122-b97e-c7f825f39d25	8ba8388f-9907-486c-9883-3784c2f2f34e	STORY_LIVE	classroom	New story is live	New Story — Start now!	unread	Start Story	/story/65ccde55-0714-49a0-9df4-88ca6734223d	{"storyId": "65ccde55-0714-49a0-9df4-88ca6734223d", "audience": "student"}	c7cb9f2c-062e-44ac-88da-c9aef09eccc7	\N	2026-05-28 14:38:03.96799+05:30	\N	2026-06-02 14:38:03.96799+05:30	2026-05-28 14:46:00.1126+05:30
da40ffb8-ad16-4966-82f5-978b1e08aa19	ff0c234b-4d70-4a86-bce2-b88ce5e0d71e	8ba8388f-9907-486c-9883-3784c2f2f34e	STORY_LIVE	classroom	New story is live	Next story — Start now!	unread	Start Story	/story/14defc83-9b7f-47e9-8e1d-3b1a010b9828	{"storyId": "14defc83-9b7f-47e9-8e1d-3b1a010b9828", "audience": "student"}	255835f2-3d51-4068-ae67-13da119f4c8f	\N	2026-05-28 15:29:06.617364+05:30	\N	2026-06-02 15:29:06.617364+05:30	\N
279ea74b-6089-4660-9f9c-321c68fe3c75	fe400696-c6f1-4122-b97e-c7f825f39d25	8ba8388f-9907-486c-9883-3784c2f2f34e	STORY_LIVE	classroom	New story is live	Next story — Start now!	read	Start Story	/story/14defc83-9b7f-47e9-8e1d-3b1a010b9828	{"storyId": "14defc83-9b7f-47e9-8e1d-3b1a010b9828", "audience": "student"}	255835f2-3d51-4068-ae67-13da119f4c8f	\N	2026-05-28 15:29:06.059729+05:30	2026-05-28 15:33:19.756509+05:30	2026-06-02 15:29:06.059729+05:30	\N
eb6d42e4-145c-4bc0-a287-2faf788965b9	ff0c234b-4d70-4a86-bce2-b88ce5e0d71e	8ba8388f-9907-486c-9883-3784c2f2f34e	STORY_LIVE	classroom	New story is live	Story newx — Start now!	unread	Start Story	/story/dcd404b8-c849-44c8-8abd-db6e9134adef	{"storyId": "dcd404b8-c849-44c8-8abd-db6e9134adef", "audience": "student"}	058ec015-e898-4ba8-a5fa-2a89911ea7af	\N	2026-05-28 15:57:18.498564+05:30	\N	2026-06-02 15:57:18.498564+05:30	\N
c0540e3b-dbbe-4fbe-b31c-67bd92023638	fe400696-c6f1-4122-b97e-c7f825f39d25	8ba8388f-9907-486c-9883-3784c2f2f34e	STORY_LIVE	classroom	New story is live	Story newx — Start now!	read	Start Story	/story/dcd404b8-c849-44c8-8abd-db6e9134adef	{"storyId": "dcd404b8-c849-44c8-8abd-db6e9134adef", "audience": "student"}	058ec015-e898-4ba8-a5fa-2a89911ea7af	\N	2026-05-28 15:57:17.938735+05:30	2026-05-28 15:58:14.25413+05:30	2026-06-02 15:57:17.938735+05:30	\N
3ef09ede-a455-41be-b5ed-95e2de38c857	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	8ba8388f-9907-486c-9883-3784c2f2f34e	CHILD_ACTIVITY	classroom	Activity in "Class 1 Classroom"	Rahul Kumar completed 1 quiz.	read	\N	\N	{"counts": {"quiz": 1, "assignment": 0}, "lastAt": "2026-05-28T10:27:56.852Z", "audience": "parent", "students": ["fe400696-c6f1-4122-b97e-c7f825f39d25"], "classroomId": "1e77a495-0570-417b-a216-7da3ebb7d6d6", "classroomTitle": "Class 1 Classroom", "lastActivityKind": "quiz_submitted", "lastStudentUserId": "fe400696-c6f1-4122-b97e-c7f825f39d25"}	780f6add-5754-48d5-94fb-7c343ec963fa	\N	2026-05-28 15:57:56.853109+05:30	2026-05-28 20:15:07.198283+05:30	2026-06-02 15:57:56.853109+05:30	2026-05-28 20:15:09.860998+05:30
afc1b55d-19e2-4e08-a74c-50c74366faf6	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	8ba8388f-9907-486c-9883-3784c2f2f34e	STORY_LIVE	classroom	A new story is available for your child	Story newx is now live.	read	\N	\N	{"storyId": "dcd404b8-c849-44c8-8abd-db6e9134adef", "audience": "parent", "studentUserId": "fe400696-c6f1-4122-b97e-c7f825f39d25"}	058ec015-e898-4ba8-a5fa-2a89911ea7af	\N	2026-05-28 15:57:18.000864+05:30	2026-05-28 20:15:07.778211+05:30	2026-06-02 15:57:18.000864+05:30	2026-05-28 20:15:10.311046+05:30
a647e07a-74a6-4373-93d9-1fac2e585865	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	8ba8388f-9907-486c-9883-3784c2f2f34e	STORY_LIVE	classroom	A new story is available for your child	Next story is now live.	read	\N	\N	{"storyId": "14defc83-9b7f-47e9-8e1d-3b1a010b9828", "audience": "parent", "studentUserId": "fe400696-c6f1-4122-b97e-c7f825f39d25"}	255835f2-3d51-4068-ae67-13da119f4c8f	\N	2026-05-28 15:29:06.124173+05:30	2026-05-28 15:33:29.337828+05:30	2026-06-02 15:29:06.124173+05:30	2026-05-28 20:15:10.503653+05:30
76897515-7f4c-48a5-b536-6747fe1cc134	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	8ba8388f-9907-486c-9883-3784c2f2f34e	STORY_LIVE	classroom	A new story is available for your child	New Story is now live.	read	\N	\N	{"storyId": "65ccde55-0714-49a0-9df4-88ca6734223d", "audience": "parent", "studentUserId": "fe400696-c6f1-4122-b97e-c7f825f39d25"}	c7cb9f2c-062e-44ac-88da-c9aef09eccc7	\N	2026-05-28 14:38:04.025302+05:30	2026-05-28 15:33:28.623667+05:30	2026-06-02 14:38:04.025302+05:30	2026-05-28 20:15:10.707421+05:30
d0698597-d8d6-4e12-adba-6255c968e076	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	8ba8388f-9907-486c-9883-3784c2f2f34e	CLASS_ENDED	classroom	Class ended	Your child has completed all work for "my Class 1 Classroom".	read	\N	\N	{"audience": "parent", "classroomId": "ad95dafa-d5ec-49cb-aeb0-5189487e7d25", "studentUserId": "fe400696-c6f1-4122-b97e-c7f825f39d25", "pendingQuizzes": 0, "pendingAssignments": 0}	2b37d6b5-d1d6-44da-9893-7d239e358841	\N	2026-05-28 13:48:36.151791+05:30	2026-05-28 13:49:54.410347+05:30	2026-06-02 13:48:36.151791+05:30	2026-05-28 20:15:11.056759+05:30
5ee6dc80-721c-46aa-976b-f82867ce034b	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	8ba8388f-9907-486c-9883-3784c2f2f34e	STUDENT_ACTIVITY	classroom	New activity in "my Class 1 Classroom"	8 quizzes from 1 student.	read	Open Class	/(tabs)/classroom	{"counts": {"quiz": 8, "assignment": 0}, "lastAt": "2026-05-28T19:28:45.151Z", "audience": "teacher", "students": ["fe400696-c6f1-4122-b97e-c7f825f39d25"], "classroomId": "ad95dafa-d5ec-49cb-aeb0-5189487e7d25", "classroomTitle": "my Class 1 Classroom", "lastActivityKind": "quiz_submitted", "lastStudentUserId": "fe400696-c6f1-4122-b97e-c7f825f39d25"}	367130c6-0afc-49dd-bae0-9bcd8071e9d7	\N	2026-05-29 00:58:45.151504+05:30	2026-05-29 01:01:20.83715+05:30	2026-06-02 23:37:00.399493+05:30	2026-05-29 16:46:32.726064+05:30
9711dd42-d7c2-4353-9804-ae7469206f6c	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	8ba8388f-9907-486c-9883-3784c2f2f34e	CHILD_ACTIVITY	classroom	Activity in "my Class 1 Classroom"	Rahul Kumar completed 5 quizzes.	read	\N	\N	{"counts": {"quiz": 5, "assignment": 0}, "lastAt": "2026-05-28T18:59:27.479Z", "audience": "parent", "students": ["fe400696-c6f1-4122-b97e-c7f825f39d25"], "classroomId": "ad95dafa-d5ec-49cb-aeb0-5189487e7d25", "classroomTitle": "my Class 1 Classroom", "lastActivityKind": "quiz_submitted", "lastStudentUserId": "fe400696-c6f1-4122-b97e-c7f825f39d25"}	0a3b1021-9c12-4340-9e0e-356e008b2c16	\N	2026-05-29 00:29:27.479423+05:30	2026-05-29 02:25:20.249694+05:30	2026-06-03 00:02:02.223873+05:30	2026-05-29 16:46:38.303832+05:30
15b1a803-7824-41be-8ecb-429fc1fc86e1	866bc022-307f-4218-94a3-7622dd2aec79	8ba8388f-9907-486c-9883-3784c2f2f34e	STUDENT_ACTIVITY	classroom	New activity in "Class 1 Classroom"	1 quiz from 1 student.	read	Open Class	/(tabs)/classroom	{"counts": {"quiz": 1, "assignment": 0}, "lastAt": "2026-05-28T10:27:56.921Z", "audience": "teacher", "students": ["fe400696-c6f1-4122-b97e-c7f825f39d25"], "classroomId": "1e77a495-0570-417b-a216-7da3ebb7d6d6", "classroomTitle": "Class 1 Classroom", "lastActivityKind": "quiz_submitted", "lastStudentUserId": "fe400696-c6f1-4122-b97e-c7f825f39d25"}	780f6add-5754-48d5-94fb-7c343ec963fa	\N	2026-05-28 15:57:56.922405+05:30	2026-05-29 16:46:49.450925+05:30	2026-06-02 15:57:56.922405+05:30	2026-05-29 16:46:50.332098+05:30
2a0c3b13-8a49-4bd8-89ff-c0ac6ab14f2c	313b3836-dd4c-4bab-8ca1-387b05062ea7	8ba8388f-9907-486c-9883-3784c2f2f34e	CLASS_LIVE	classroom	Class ended	LKG Morning Class - Week 1 is starting now. Tap to join.	read	\N	\N	{"expired": true, "isRestart": false, "startTime": null, "classroomId": "0472805e-b7db-4684-aae0-5d6f3091db22", "expiredReason": "ended"}	14dc8b7f-d445-4804-bfd8-1aab36697959	\N	2026-05-29 21:08:59.569854+05:30	2026-05-29 21:08:59.721747+05:30	2026-06-03 21:08:59.569854+05:30	\N
88966d78-6a05-41be-a458-40696c8661a3	c2fd6bc5-5766-4eba-b691-0438f77e3d33	8ba8388f-9907-486c-9883-3784c2f2f34e	STUDENT_ACTIVITY	classroom	New activity in "New Class"	2 quizzes from 1 student.	unread	Open Class	/(tabs)/classroom	{"counts": {"quiz": 2, "assignment": 0}, "lastAt": "2026-05-28T20:55:13.053Z", "audience": "teacher", "students": ["d263eb62-0c0f-458b-bf31-654549c58655"], "classroomId": "7377d102-150d-46c0-8518-fcda6a54030d", "classroomTitle": "New Class", "lastActivityKind": "quiz_submitted", "lastStudentUserId": "d263eb62-0c0f-458b-bf31-654549c58655"}	b1e620db-8967-4065-bb51-d5200638b6fd	\N	2026-05-29 02:25:13.054816+05:30	\N	2026-06-03 02:25:12.026339+05:30	\N
4fd66f34-acc4-49e9-bdcf-5f82a014b273	c2fd6bc5-5766-4eba-b691-0438f77e3d33	8ba8388f-9907-486c-9883-3784c2f2f34e	STUDENT_ACTIVITY	classroom	New activity in "New Class"	1 quiz from 1 student.	unread	Open Class	/(tabs)/classroom	{"counts": {"quiz": 1, "assignment": 0}, "lastAt": "2026-05-29T07:11:53.653Z", "audience": "teacher", "students": ["3d074d19-5d5d-46fa-b43c-9f1c9f257983"], "classroomId": "7377d102-150d-46c0-8518-fcda6a54030d", "classroomTitle": "New Class", "lastActivityKind": "quiz_submitted", "lastStudentUserId": "3d074d19-5d5d-46fa-b43c-9f1c9f257983"}	7584973e-844e-45d0-9788-d98519225931	\N	2026-05-29 12:41:53.653989+05:30	\N	2026-06-03 12:41:53.653989+05:30	\N
f9b3484a-6778-49a2-bba8-a28c4cbcf4a9	b2b8e045-2b56-46a6-ac1e-77b19b4ba586	8ba8388f-9907-486c-9883-3784c2f2f34e	CHILD_ACTIVITY	classroom	Activity in "Class 1 Classroom"	hkc welcome completed 1 quiz.	read	\N	\N	{"counts": {"quiz": 1, "assignment": 0}, "lastAt": "2026-05-29T07:12:05.812Z", "audience": "parent", "students": ["3d074d19-5d5d-46fa-b43c-9f1c9f257983"], "classroomId": "1e77a495-0570-417b-a216-7da3ebb7d6d6", "classroomTitle": "Class 1 Classroom", "lastActivityKind": "quiz_submitted", "lastStudentUserId": "3d074d19-5d5d-46fa-b43c-9f1c9f257983"}	160940da-0b9e-40e7-a46d-8f2ab1445084	\N	2026-05-29 12:42:05.812464+05:30	2026-05-29 12:43:44.262734+05:30	2026-06-03 12:42:05.812464+05:30	\N
3be22f03-cbd3-4104-b1ae-015c72fb10c3	b2b8e045-2b56-46a6-ac1e-77b19b4ba586	8ba8388f-9907-486c-9883-3784c2f2f34e	CHILD_ACTIVITY	classroom	Activity in "New Class"	hkc welcome completed 1 quiz.	read	\N	\N	{"counts": {"quiz": 1, "assignment": 0}, "lastAt": "2026-05-29T07:11:53.583Z", "audience": "parent", "students": ["3d074d19-5d5d-46fa-b43c-9f1c9f257983"], "classroomId": "7377d102-150d-46c0-8518-fcda6a54030d", "classroomTitle": "New Class", "lastActivityKind": "quiz_submitted", "lastStudentUserId": "3d074d19-5d5d-46fa-b43c-9f1c9f257983"}	7584973e-844e-45d0-9788-d98519225931	\N	2026-05-29 12:41:53.583677+05:30	2026-05-29 12:43:44.787235+05:30	2026-06-03 12:41:53.583677+05:30	\N
0db294db-c57f-48ef-91c3-f616ba08de33	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	8ba8388f-9907-486c-9883-3784c2f2f34e	STUDENT_ACTIVITY	classroom	New activity in "my Class 1 Classroom"	3 quizzes from 1 student.	read	Open Class	/(tabs)/classroom	{"counts": {"quiz": 3, "assignment": 0}, "lastAt": "2026-05-28T20:52:37.110Z", "audience": "teacher", "students": ["fe400696-c6f1-4122-b97e-c7f825f39d25"], "classroomId": "ad95dafa-d5ec-49cb-aeb0-5189487e7d25", "classroomTitle": "my Class 1 Classroom", "lastActivityKind": "quiz_submitted", "lastStudentUserId": "fe400696-c6f1-4122-b97e-c7f825f39d25"}	96f59aa6-6c86-4499-9523-50e8884670ae	\N	2026-05-29 02:22:37.110581+05:30	2026-05-29 15:58:24.612294+05:30	2026-06-03 02:20:09.355218+05:30	2026-05-29 16:46:32.726064+05:30
5b3ca463-5869-4c7b-9558-0523b2a05e65	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	8ba8388f-9907-486c-9883-3784c2f2f34e	CHILD_ACTIVITY	classroom	Activity in "my Class 1 Classroom"	Rahul Kumar completed 2 quizzes.	read	\N	\N	{"counts": {"quiz": 2, "assignment": 0}, "lastAt": "2026-05-28T18:11:44.248Z", "audience": "parent", "students": ["fe400696-c6f1-4122-b97e-c7f825f39d25"], "classroomId": "ad95dafa-d5ec-49cb-aeb0-5189487e7d25", "classroomTitle": "my Class 1 Classroom", "lastActivityKind": "quiz_submitted", "lastStudentUserId": "fe400696-c6f1-4122-b97e-c7f825f39d25"}	367130c6-0afc-49dd-bae0-9bcd8071e9d7	\N	2026-05-28 23:41:44.248983+05:30	2026-05-29 00:05:38.469313+05:30	2026-06-02 23:37:00.23592+05:30	2026-05-29 16:46:38.303832+05:30
6a67c6ce-689d-41d6-8129-cd9012d9aedf	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	8ba8388f-9907-486c-9883-3784c2f2f34e	CHILD_ACTIVITY	classroom	Activity in "my Class 1 Classroom"	Rahul Kumar completed 3 quizzes.	read	\N	\N	{"counts": {"quiz": 3, "assignment": 0}, "lastAt": "2026-05-28T20:52:37.043Z", "audience": "parent", "students": ["fe400696-c6f1-4122-b97e-c7f825f39d25"], "classroomId": "ad95dafa-d5ec-49cb-aeb0-5189487e7d25", "classroomTitle": "my Class 1 Classroom", "lastActivityKind": "quiz_submitted", "lastStudentUserId": "fe400696-c6f1-4122-b97e-c7f825f39d25"}	96f59aa6-6c86-4499-9523-50e8884670ae	\N	2026-05-29 02:22:37.043474+05:30	2026-05-29 02:25:19.634733+05:30	2026-06-03 02:20:09.272679+05:30	2026-05-29 16:46:38.303832+05:30
25b92c88-e668-43f0-8b0e-bc8ea2d65d90	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	8ba8388f-9907-486c-9883-3784c2f2f34e	CHILD_ACTIVITY	classroom	Activity in "my Class 1 Classroom"	Rahul Kumar completed 3 quizzes.	unread	\N	\N	{"counts": {"quiz": 3, "assignment": 0}, "lastAt": "2026-05-29T09:13:04.905Z", "audience": "parent", "students": ["fe400696-c6f1-4122-b97e-c7f825f39d25"], "classroomId": "ad95dafa-d5ec-49cb-aeb0-5189487e7d25", "classroomTitle": "my Class 1 Classroom", "lastActivityKind": "quiz_submitted", "lastStudentUserId": "fe400696-c6f1-4122-b97e-c7f825f39d25"}	2b75e3b3-0907-4662-bc76-245266a818bf	\N	2026-05-29 14:43:04.90564+05:30	\N	2026-06-03 14:42:20.208961+05:30	2026-05-29 16:46:39.636702+05:30
2879f075-2a17-4757-ba7e-924970b7c262	866bc022-307f-4218-94a3-7622dd2aec79	8ba8388f-9907-486c-9883-3784c2f2f34e	STUDENT_ACTIVITY	classroom	New activity in "Class 1 Classroom"	1 quiz from 1 student.	read	Open Class	/(tabs)/classroom	{"counts": {"quiz": 1, "assignment": 0}, "lastAt": "2026-05-29T07:12:05.874Z", "audience": "teacher", "students": ["3d074d19-5d5d-46fa-b43c-9f1c9f257983"], "classroomId": "1e77a495-0570-417b-a216-7da3ebb7d6d6", "classroomTitle": "Class 1 Classroom", "lastActivityKind": "quiz_submitted", "lastStudentUserId": "3d074d19-5d5d-46fa-b43c-9f1c9f257983"}	160940da-0b9e-40e7-a46d-8f2ab1445084	\N	2026-05-29 12:42:05.875329+05:30	2026-05-29 16:46:49.450925+05:30	2026-06-03 12:42:05.875329+05:30	2026-05-29 16:46:50.178172+05:30
9369cf2b-f4ee-429e-8a65-d91f592af2e9	313b3836-dd4c-4bab-8ca1-387b05062ea7	8ba8388f-9907-486c-9883-3784c2f2f34e	CLASS_LIVE	classroom	Your class is live	LKG Daily Learning Class is starting now. Tap to join.	unread	Join Class	/(tabs)/classroom	{"isRestart": false, "startTime": null, "classroomId": "614f3843-4e23-4867-8c85-45e79fd2e859"}	4d23496c-4052-4a30-b201-0294bec20726	\N	2026-05-29 21:02:28.036074+05:30	\N	2026-06-03 21:02:28.036074+05:30	\N
19df2b8d-ad76-442a-a931-87b6760fbb7c	313b3836-dd4c-4bab-8ca1-387b05062ea7	8ba8388f-9907-486c-9883-3784c2f2f34e	CLASS_ENDED_PENDING	classroom	Class ended — finish your work	Class "LKG Morning Class - Week 1" has ended. Please finish and submit 1 quiz and 1 assignment before the deadline.	unread	Submit Now	/(tabs)/classroom	{"classroomId": "0472805e-b7db-4684-aae0-5d6f3091db22", "pendingQuizzes": [{"id": "b535df36-c742-4235-84fd-7111abe88b3f", "title": "LKG English - Alphabet and Phonics"}], "pendingAssignments": [{"id": "334543c1-f036-4828-9f60-f1eaf5da0e3d", "title": "Bring a leaf to class"}]}	78f78a39-87b0-4a1a-8481-bfdc91ce505d	\N	2026-05-29 21:09:00.132568+05:30	\N	2026-06-03 21:09:00.132568+05:30	\N
6bdae8cf-c25b-41f5-aec6-703851f77360	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	8ba8388f-9907-486c-9883-3784c2f2f34e	STUDENT_ACTIVITY	classroom	New activity in "my Class 1 Classroom"	3 quizzes from 1 student.	read	Open Class	/(tabs)/classroom	{"counts": {"quiz": 3, "assignment": 0}, "lastAt": "2026-05-29T09:13:04.960Z", "audience": "teacher", "students": ["fe400696-c6f1-4122-b97e-c7f825f39d25"], "classroomId": "ad95dafa-d5ec-49cb-aeb0-5189487e7d25", "classroomTitle": "my Class 1 Classroom", "lastActivityKind": "quiz_submitted", "lastStudentUserId": "fe400696-c6f1-4122-b97e-c7f825f39d25"}	2b75e3b3-0907-4662-bc76-245266a818bf	\N	2026-05-29 14:43:04.960629+05:30	2026-05-29 15:58:24.612294+05:30	2026-06-03 14:42:20.528853+05:30	2026-05-29 16:46:32.726064+05:30
ebddbe2a-5328-4b09-9d23-dae274bc5e50	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	8ba8388f-9907-486c-9883-3784c2f2f34e	STUDENT_ACTIVITY	classroom	New activity in "my Class 1 Classroom"	1 quiz from 1 student.	read	Open Class	/(tabs)/classroom	{"counts": {"quiz": 1, "assignment": 0}, "lastAt": "2026-05-29T11:02:14.805Z", "audience": "teacher", "students": ["fe400696-c6f1-4122-b97e-c7f825f39d25"], "classroomId": "ad95dafa-d5ec-49cb-aeb0-5189487e7d25", "classroomTitle": "my Class 1 Classroom", "lastActivityKind": "quiz_submitted", "lastStudentUserId": "fe400696-c6f1-4122-b97e-c7f825f39d25"}	aadb8efd-3eb3-4a96-9ae2-f7b1bc3c383e	\N	2026-05-29 16:32:14.80551+05:30	2026-05-29 16:46:22.23792+05:30	2026-06-03 16:32:14.80551+05:30	2026-05-29 16:46:32.726064+05:30
1fd07552-3db5-471d-ba81-0e840c3a9411	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	8ba8388f-9907-486c-9883-3784c2f2f34e	CHILD_ACTIVITY	classroom	Activity in "my Class 1 Classroom"	Rahul Kumar completed 1 quiz.	read	\N	\N	{"counts": {"quiz": 1, "assignment": 0}, "lastAt": "2026-05-28T19:28:45.088Z", "audience": "parent", "students": ["fe400696-c6f1-4122-b97e-c7f825f39d25"], "classroomId": "ad95dafa-d5ec-49cb-aeb0-5189487e7d25", "classroomTitle": "my Class 1 Classroom", "lastActivityKind": "quiz_submitted", "lastStudentUserId": "fe400696-c6f1-4122-b97e-c7f825f39d25"}	6bdb2ddb-cebe-4a54-b2d3-22f4a20812d9	\N	2026-05-29 00:58:45.088366+05:30	2026-05-29 02:25:19.907608+05:30	2026-06-03 00:58:45.088366+05:30	2026-05-29 16:46:38.303832+05:30
4da9c7d9-dfab-49cd-a74f-e0f18e0f946b	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	8ba8388f-9907-486c-9883-3784c2f2f34e	CHILD_ACTIVITY	classroom	Activity in "my Class 1 Classroom"	Rahul Kumar completed 1 quiz.	unread	\N	\N	{"counts": {"quiz": 1, "assignment": 0}, "lastAt": "2026-05-29T11:02:14.720Z", "audience": "parent", "students": ["fe400696-c6f1-4122-b97e-c7f825f39d25"], "classroomId": "ad95dafa-d5ec-49cb-aeb0-5189487e7d25", "classroomTitle": "my Class 1 Classroom", "lastActivityKind": "quiz_submitted", "lastStudentUserId": "fe400696-c6f1-4122-b97e-c7f825f39d25"}	aadb8efd-3eb3-4a96-9ae2-f7b1bc3c383e	\N	2026-05-29 16:32:14.722039+05:30	\N	2026-06-03 16:32:14.722039+05:30	2026-05-29 16:46:38.926997+05:30
9545d5ea-57f4-4e82-a720-8b61e67ac06a	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	8ba8388f-9907-486c-9883-3784c2f2f34e	CHILD_ACTIVITY	classroom	Activity in "my Class 1 Classroom"	Rahul Kumar completed 1 quiz.	unread	\N	\N	{"counts": {"quiz": 1, "assignment": 0}, "lastAt": "2026-05-29T11:36:28.743Z", "audience": "parent", "students": ["fe400696-c6f1-4122-b97e-c7f825f39d25"], "classroomId": "ad95dafa-d5ec-49cb-aeb0-5189487e7d25", "classroomTitle": "my Class 1 Classroom", "lastActivityKind": "quiz_submitted", "lastStudentUserId": "fe400696-c6f1-4122-b97e-c7f825f39d25"}	cde74f49-696e-43ec-8f34-263a26ddd089	\N	2026-05-29 17:06:28.744192+05:30	\N	2026-06-03 17:06:28.744192+05:30	\N
80b63aee-fcc9-416a-98f0-64cff095ac45	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	8ba8388f-9907-486c-9883-3784c2f2f34e	STUDENT_ACTIVITY	classroom	New activity in "my Class 1 Classroom"	1 quiz from 1 student.	read	Open Class	/(tabs)/classroom	{"counts": {"quiz": 1, "assignment": 0}, "lastAt": "2026-05-29T11:36:28.815Z", "audience": "teacher", "students": ["fe400696-c6f1-4122-b97e-c7f825f39d25"], "classroomId": "ad95dafa-d5ec-49cb-aeb0-5189487e7d25", "classroomTitle": "my Class 1 Classroom", "lastActivityKind": "quiz_submitted", "lastStudentUserId": "fe400696-c6f1-4122-b97e-c7f825f39d25"}	cde74f49-696e-43ec-8f34-263a26ddd089	\N	2026-05-29 17:06:28.816566+05:30	2026-05-29 20:58:56.359111+05:30	2026-06-03 17:06:28.816566+05:30	\N
8b7d28f0-6f79-4600-8c88-24a2af8a8d5a	313b3836-dd4c-4bab-8ca1-387b05062ea7	8ba8388f-9907-486c-9883-3784c2f2f34e	STORY_LIVE	classroom	New story is live	The Wise Old Owl — Start now!	unread	Start Story	/story/ffab6f2a-98af-4dc5-bf19-e8cfcb6d3301	{"storyId": "ffab6f2a-98af-4dc5-bf19-e8cfcb6d3301", "audience": "student"}	c74bfebb-7551-4379-a0d7-9cd3be8e49c1	\N	2026-05-29 21:09:00.218348+05:30	\N	2026-06-03 21:09:00.218348+05:30	\N
\.


--
-- Data for Name: organization_subscriptions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.organization_subscriptions (id, organization_id, plan_id, status, trial_start_at, trial_end_at, starts_at, ends_at, final_price, seat_count, offer_discount_percent, special_discount_percent, group_discount_percent, created_at, updated_at) FROM stdin;
ad801c1e-90d5-4f58-a21f-8a36e4f4efd0	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	trialing	2026-05-27 22:50:57.030238	2026-06-10 22:50:57.030238	2026-05-27 22:50:57.030238	\N	\N	1	0.00	0.00	0.00	2026-05-27 22:50:57.030238	2026-05-27 22:50:57.030238
e26553b8-e250-4152-b7e3-ac346872099f	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	trialing	2026-05-27 22:52:22.025764	2026-06-10 22:52:22.025764	2026-05-27 22:52:22.025764	\N	\N	1	0.00	0.00	0.00	2026-05-27 22:52:22.025764	2026-05-27 22:52:22.025764
defe8587-3b21-4b47-9661-17dbac90898c	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	trialing	2026-05-27 22:56:47.482416	2026-06-10 22:56:47.482416	2026-05-27 22:56:47.482416	\N	\N	1	0.00	0.00	0.00	2026-05-27 22:56:47.482416	2026-05-27 22:56:47.482416
9d81ac9c-0240-419d-9501-61c716579a06	8ba8388f-9907-486c-9883-3784c2f2f34e	78366682-47b1-4d4a-8865-c2cb6f801cf0	active	\N	\N	2026-05-27 21:25:02.353229	2026-06-27 21:25:02.353229	24975.00	25	0.00	0.00	0.00	2026-05-27 21:25:02.353229	2026-05-27 23:03:35.188743
171c6d04-4b84-43e1-8940-f1af70c811fd	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	trialing	2026-05-27 23:27:36.901002	2026-06-10 23:27:36.901002	2026-05-27 23:27:36.901002	\N	\N	1	0.00	0.00	0.00	2026-05-27 23:27:36.901002	2026-05-27 23:27:36.901002
86a4edd4-d4c4-4c2b-8bb1-f99976d66edc	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	trialing	2026-05-27 23:27:36.900891	2026-06-10 23:27:36.900891	2026-05-27 23:27:36.900891	\N	\N	1	0.00	0.00	0.00	2026-05-27 23:27:36.900891	2026-05-27 23:27:36.900891
9f8cedf0-f88e-4b76-928d-db00712adf6d	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	cancelled	2026-05-27 15:11:58.386265	2026-06-10 15:11:58.386265	2026-05-27 15:11:58.386265	\N	\N	1	0.00	0.00	0.00	2026-05-27 15:11:58.386265	2026-05-27 21:22:33.829251
e76687e4-aec2-46be-8c39-e012fbbbc01a	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	cancelled	2026-05-27 15:11:58.386265	2026-06-10 15:11:58.386265	2026-05-27 15:11:58.386265	\N	\N	1	0.00	0.00	0.00	2026-05-27 15:11:58.386265	2026-05-27 21:22:33.829251
3aa4871f-a9c4-4826-b04b-58595c792b74	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	cancelled	2026-05-27 20:00:31.123909	2026-06-10 20:00:31.123909	2026-05-27 20:00:31.123909	\N	\N	1	0.00	0.00	0.00	2026-05-27 20:00:31.123909	2026-05-27 21:22:33.829251
3790889b-3c19-4fc0-a498-955db5c9233a	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	cancelled	2026-05-27 20:34:30.756676	2026-06-10 20:34:30.756676	2026-05-27 20:34:30.756676	\N	\N	1	0.00	0.00	0.00	2026-05-27 20:34:30.756676	2026-05-27 21:22:33.829251
3235fa1c-2f65-4a13-a56e-76360e9fb5a2	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	cancelled	2026-05-27 20:34:30.756492	2026-06-10 20:34:30.756492	2026-05-27 20:34:30.756492	\N	\N	1	0.00	0.00	0.00	2026-05-27 20:34:30.756492	2026-05-27 21:22:33.829251
6ac9459b-5e9c-4449-ba96-9eb9bdd3b1f6	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	cancelled	2026-05-27 20:34:30.756721	2026-06-10 20:34:30.756721	2026-05-27 20:34:30.756721	\N	\N	1	0.00	0.00	0.00	2026-05-27 20:34:30.756721	2026-05-27 21:22:33.829251
5d7e4afd-6b66-4f52-b616-dd4839ea33e5	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	cancelled	2026-05-27 20:34:44.569447	2026-06-10 20:34:44.569447	2026-05-27 20:34:44.569447	\N	\N	1	0.00	0.00	0.00	2026-05-27 20:34:44.569447	2026-05-27 21:22:33.829251
64d1ba9f-6692-45dc-ac2f-9b9b222c3527	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	cancelled	2026-05-27 21:12:33.758794	2026-06-10 21:12:33.758794	2026-05-27 21:12:33.758794	\N	\N	1	0.00	0.00	0.00	2026-05-27 21:12:33.758794	2026-05-27 21:22:33.829251
8bb42fcd-a1aa-4d42-890c-05f1885ab361	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	cancelled	2026-05-27 21:12:33.758827	2026-06-10 21:12:33.758827	2026-05-27 21:12:33.758827	\N	\N	1	0.00	0.00	0.00	2026-05-27 21:12:33.758827	2026-05-27 21:22:33.829251
90dd1815-5d1f-42a4-aaf9-c7682a56651a	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	cancelled	2026-05-27 21:12:33.75894	2026-06-10 21:12:33.75894	2026-05-27 21:12:33.75894	\N	\N	1	0.00	0.00	0.00	2026-05-27 21:12:33.75894	2026-05-27 21:22:33.829251
cab965ac-bba3-49e4-baa1-860ab8d29073	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	cancelled	2026-05-27 21:13:10.905036	2026-06-10 21:13:10.905036	2026-05-27 21:13:10.905036	\N	\N	1	0.00	0.00	0.00	2026-05-27 21:13:10.905036	2026-05-27 21:22:33.829251
a36bbb12-146b-4a3d-9a38-7205f46207af	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	cancelled	2026-05-27 21:19:57.797019	2026-06-10 21:19:57.797019	2026-05-27 21:19:57.797019	\N	\N	1	0.00	0.00	0.00	2026-05-27 21:19:57.797019	2026-05-27 21:22:33.829251
779d2f07-999d-43a0-932a-345a2b9222ee	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	cancelled	2026-05-27 21:19:57.79693	2026-06-10 21:19:57.79693	2026-05-27 21:19:57.79693	\N	\N	1	0.00	0.00	0.00	2026-05-27 21:19:57.79693	2026-05-27 21:22:33.829251
8861caf2-f206-4f02-b932-c9034a4d8b78	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	cancelled	2026-05-27 21:20:11.399045	2026-06-10 21:20:11.399045	2026-05-27 21:20:11.399045	\N	\N	1	0.00	0.00	0.00	2026-05-27 21:20:11.399045	2026-05-27 21:22:33.829251
a73cc5b1-6478-4cd0-87c2-e49ab4daf867	8ba8388f-9907-486c-9883-3784c2f2f34e	78366682-47b1-4d4a-8865-c2cb6f801cf0	active	\N	\N	2026-05-27 21:25:03.162633	2026-06-27 21:25:03.162633	24975.00	25	0.00	0.00	0.00	2026-05-27 21:25:03.162633	2026-05-27 21:25:03.162633
be8cd054-15c6-4249-9098-fb197824e706	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	trialing	2026-05-27 22:38:42.139293	2026-06-10 22:38:42.139293	2026-05-27 22:38:42.139293	\N	\N	1	0.00	0.00	0.00	2026-05-27 22:38:42.139293	2026-05-27 22:38:42.139293
2d15693d-e233-49fa-9bf3-7910f6ec03d1	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	trialing	2026-05-27 22:38:42.13931	2026-06-10 22:38:42.13931	2026-05-27 22:38:42.13931	\N	\N	1	0.00	0.00	0.00	2026-05-27 22:38:42.13931	2026-05-27 22:38:42.13931
4f389889-b84f-4311-a048-8712346c6aeb	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	trialing	2026-05-27 22:38:42.139676	2026-06-10 22:38:42.139676	2026-05-27 22:38:42.139676	\N	\N	1	0.00	0.00	0.00	2026-05-27 22:38:42.139676	2026-05-27 22:38:42.139676
2156fcac-ce86-4599-a499-c6fffe57a806	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	trialing	2026-05-27 23:27:38.536525	2026-06-10 23:27:38.536525	2026-05-27 23:27:38.536525	\N	\N	1	0.00	0.00	0.00	2026-05-27 23:27:38.536525	2026-05-27 23:27:38.536525
96fe0626-f0aa-4616-917a-f0fac5fced85	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	trialing	2026-05-27 23:29:19.763596	2026-06-10 23:29:19.763596	2026-05-27 23:29:19.763596	\N	\N	1	0.00	0.00	0.00	2026-05-27 23:29:19.763596	2026-05-27 23:29:19.763596
e87cfafa-aaa6-4c12-a624-a3da218652ea	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	trialing	2026-05-27 23:36:55.85571	2026-06-10 23:36:55.85571	2026-05-27 23:36:55.85571	\N	\N	1	0.00	0.00	0.00	2026-05-27 23:36:55.85571	2026-05-27 23:36:55.85571
8d5b9489-9ef7-4501-b900-374644592160	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	trialing	2026-05-27 23:37:12.416734	2026-06-10 23:37:12.416734	2026-05-27 23:37:12.416734	\N	\N	1	0.00	0.00	0.00	2026-05-27 23:37:12.416734	2026-05-27 23:37:12.416734
72c60a9f-5b44-4e0e-b0a3-60eff886c5c3	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	trialing	2026-05-27 23:41:37.920608	2026-06-10 23:41:37.920608	2026-05-27 23:41:37.920608	\N	\N	1	0.00	0.00	0.00	2026-05-27 23:41:37.920608	2026-05-27 23:41:37.920608
da4f4ff5-0644-4c20-9a7f-0553c6cbe12f	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	trialing	2026-05-27 23:41:37.920553	2026-06-10 23:41:37.920553	2026-05-27 23:41:37.920553	\N	\N	1	0.00	0.00	0.00	2026-05-27 23:41:37.920553	2026-05-27 23:41:37.920553
1c8773f8-7304-4610-9eb9-e56b8e9a8783	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	trialing	2026-05-27 23:41:54.315711	2026-06-10 23:41:54.315711	2026-05-27 23:41:54.315711	\N	\N	1	0.00	0.00	0.00	2026-05-27 23:41:54.315711	2026-05-27 23:41:54.315711
0a662151-f310-4a70-a3ad-99b7e6df5eb8	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	trialing	2026-05-27 23:47:04.059641	2026-06-10 23:47:04.059641	2026-05-27 23:47:04.059641	\N	\N	1	0.00	0.00	0.00	2026-05-27 23:47:04.059641	2026-05-27 23:47:04.059641
2894dee5-32f8-4692-a545-7801bda69651	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	trialing	2026-05-27 23:47:04.059534	2026-06-10 23:47:04.059534	2026-05-27 23:47:04.059534	\N	\N	1	0.00	0.00	0.00	2026-05-27 23:47:04.059534	2026-05-27 23:47:04.059534
37332e47-2403-4072-8cb0-11e47ee926d8	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	trialing	2026-05-27 23:47:05.533769	2026-06-10 23:47:05.533769	2026-05-27 23:47:05.533769	\N	\N	1	0.00	0.00	0.00	2026-05-27 23:47:05.533769	2026-05-27 23:47:05.533769
32912d72-b64a-4990-a3b0-6039c3adfae0	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	trialing	2026-05-27 23:52:46.069181	2026-06-10 23:52:46.069181	2026-05-27 23:52:46.069181	\N	\N	1	0.00	0.00	0.00	2026-05-27 23:52:46.069181	2026-05-27 23:52:46.069181
5de5e189-e87a-4f01-8c47-a727f199d0af	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	trialing	2026-05-27 23:52:46.069181	2026-06-10 23:52:46.069181	2026-05-27 23:52:46.069181	\N	\N	1	0.00	0.00	0.00	2026-05-27 23:52:46.069181	2026-05-27 23:52:46.069181
0f1f804d-ce66-4ad0-b597-31995fed20dc	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	trialing	2026-05-27 23:53:02.482007	2026-06-10 23:53:02.482007	2026-05-27 23:53:02.482007	\N	\N	1	0.00	0.00	0.00	2026-05-27 23:53:02.482007	2026-05-27 23:53:02.482007
7cf6f63a-291a-43ed-947a-8022f4181d0b	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	trialing	2026-05-27 23:58:04.800861	2026-06-10 23:58:04.800861	2026-05-27 23:58:04.800861	\N	\N	1	0.00	0.00	0.00	2026-05-27 23:58:04.800861	2026-05-27 23:58:04.800861
e1fe54bc-6245-4b44-8e06-abffe35b14d8	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	trialing	2026-05-28 00:00:07.712864	2026-06-11 00:00:07.712864	2026-05-28 00:00:07.712864	\N	\N	1	0.00	0.00	0.00	2026-05-28 00:00:07.712864	2026-05-28 00:00:07.712864
057afe28-794c-4bb2-b55c-3059000c9405	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	trialing	2026-05-28 00:07:34.674631	2026-06-11 00:07:34.674631	2026-05-28 00:07:34.674631	\N	\N	1	0.00	0.00	0.00	2026-05-28 00:07:34.674631	2026-05-28 00:07:34.674631
4f687ee6-4da5-44e5-9f03-0b451786e6e0	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	trialing	2026-05-28 00:07:51.289018	2026-06-11 00:07:51.289018	2026-05-28 00:07:51.289018	\N	\N	1	0.00	0.00	0.00	2026-05-28 00:07:51.289018	2026-05-28 00:07:51.289018
229f29dd-a8d9-471d-92b5-a3005ae79a5d	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	trialing	2026-05-28 00:15:51.003472	2026-06-11 00:15:51.003472	2026-05-28 00:15:51.003472	\N	\N	1	0.00	0.00	0.00	2026-05-28 00:15:51.003472	2026-05-28 00:15:51.003472
bfd5fd6c-1576-412f-a671-d14dcb9f6b0c	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	trialing	2026-05-28 00:16:07.571694	2026-06-11 00:16:07.571694	2026-05-28 00:16:07.571694	\N	\N	1	0.00	0.00	0.00	2026-05-28 00:16:07.571694	2026-05-28 00:16:07.571694
4e693b40-f715-4116-865c-9259d2223459	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	trialing	2026-05-28 00:18:22.498066	2026-06-11 00:18:22.498066	2026-05-28 00:18:22.498066	\N	\N	1	0.00	0.00	0.00	2026-05-28 00:18:22.498066	2026-05-28 00:18:22.498066
06cd5dd1-a03e-4437-987c-b8d285bffd87	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	trialing	2026-05-28 00:18:38.27009	2026-06-11 00:18:38.27009	2026-05-28 00:18:38.27009	\N	\N	1	0.00	0.00	0.00	2026-05-28 00:18:38.27009	2026-05-28 00:18:38.27009
705d5a09-5157-4d86-90d4-9af4d7edeb69	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	trialing	2026-05-28 00:29:26.306191	2026-06-11 00:29:26.306191	2026-05-28 00:29:26.306191	\N	\N	1	0.00	0.00	0.00	2026-05-28 00:29:26.306191	2026-05-28 00:29:26.306191
42e9a9d2-650a-4dfd-9f95-bd25814f04f5	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	trialing	2026-05-28 00:29:28.500152	2026-06-11 00:29:28.500152	2026-05-28 00:29:28.500152	\N	\N	1	0.00	0.00	0.00	2026-05-28 00:29:28.500152	2026-05-28 00:29:28.500152
ccc08adc-6555-4e78-b1bd-4c26448fc391	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	trialing	2026-05-28 00:40:51.821281	2026-06-11 00:40:51.821281	2026-05-28 00:40:51.821281	\N	\N	1	0.00	0.00	0.00	2026-05-28 00:40:51.821281	2026-05-28 00:40:51.821281
49b6c04b-4016-48f3-9a0e-70352f0bcc45	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	trialing	2026-05-28 00:41:08.447016	2026-06-11 00:41:08.447016	2026-05-28 00:41:08.447016	\N	\N	1	0.00	0.00	0.00	2026-05-28 00:41:08.447016	2026-05-28 00:41:08.447016
87c6bdbe-a5c2-46ed-adb7-8e93ed08be42	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	trialing	2026-05-28 00:43:17.171807	2026-06-11 00:43:17.171807	2026-05-28 00:43:17.171807	\N	\N	1	0.00	0.00	0.00	2026-05-28 00:43:17.171807	2026-05-28 00:43:17.171807
addf25ae-6ab1-41a1-92ed-7a5a3807d79b	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	trialing	2026-05-28 00:43:33.508816	2026-06-11 00:43:33.508816	2026-05-28 00:43:33.508816	\N	\N	1	0.00	0.00	0.00	2026-05-28 00:43:33.508816	2026-05-28 00:43:33.508816
dbaf4071-5cfd-437a-a1cf-3d10fa6dd61a	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	trialing	2026-05-28 00:56:21.298547	2026-06-11 00:56:21.298547	2026-05-28 00:56:21.298547	\N	\N	1	0.00	0.00	0.00	2026-05-28 00:56:21.298547	2026-05-28 00:56:21.298547
b24ad9e5-02b2-4576-83fe-57bf9672baee	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	trialing	2026-05-28 00:56:37.583966	2026-06-11 00:56:37.583966	2026-05-28 00:56:37.583966	\N	\N	1	0.00	0.00	0.00	2026-05-28 00:56:37.583966	2026-05-28 00:56:37.583966
8c4dec82-38e5-40a3-ad61-96683549446a	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	trialing	2026-05-28 01:03:57.68246	2026-06-11 01:03:57.68246	2026-05-28 01:03:57.68246	\N	\N	1	0.00	0.00	0.00	2026-05-28 01:03:57.68246	2026-05-28 01:03:57.68246
fe56a115-4a34-4b61-86e9-7d497a9fe9a6	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	trialing	2026-05-28 01:04:14.212636	2026-06-11 01:04:14.212636	2026-05-28 01:04:14.212636	\N	\N	1	0.00	0.00	0.00	2026-05-28 01:04:14.212636	2026-05-28 01:04:14.212636
61a31fd9-3821-4acf-aa74-e22ebd63ec67	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	trialing	2026-05-28 13:44:14.717754	2026-06-11 13:44:14.717754	2026-05-28 13:44:14.717754	\N	\N	1	0.00	0.00	0.00	2026-05-28 13:44:14.717754	2026-05-28 13:44:14.717754
fd5ae827-4ad0-4b3f-b568-9d04399fe2c3	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	trialing	2026-05-28 13:44:14.717162	2026-06-11 13:44:14.717162	2026-05-28 13:44:14.717162	\N	\N	1	0.00	0.00	0.00	2026-05-28 13:44:14.717162	2026-05-28 13:44:14.717162
c65b64ae-9a7d-4e46-b9b0-01363d4626bd	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	trialing	2026-05-28 13:44:31.394358	2026-06-11 13:44:31.394358	2026-05-28 13:44:31.394358	\N	\N	1	0.00	0.00	0.00	2026-05-28 13:44:31.394358	2026-05-28 13:44:31.394358
3b8d026a-ca0f-4a2b-9d2f-31fac6ce904f	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	trialing	2026-05-28 14:19:35.087286	2026-06-11 14:19:35.087286	2026-05-28 14:19:35.087286	\N	\N	1	0.00	0.00	0.00	2026-05-28 14:19:35.087286	2026-05-28 14:19:35.087286
6c0d6813-c4f4-4a5e-b98f-b04a9367457c	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	trialing	2026-05-28 14:33:07.334504	2026-06-11 14:33:07.334504	2026-05-28 14:33:07.334504	\N	\N	1	0.00	0.00	0.00	2026-05-28 14:33:07.334504	2026-05-28 14:33:07.334504
87368b36-97f3-4a53-8a16-b7df7d76fe8d	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	trialing	2026-05-28 14:35:05.886012	2026-06-11 14:35:05.886012	2026-05-28 14:35:05.886012	\N	\N	1	0.00	0.00	0.00	2026-05-28 14:35:05.886012	2026-05-28 14:35:05.886012
e2f19ccd-146d-4a99-867b-0f7484213fbf	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	trialing	2026-05-28 14:35:21.694621	2026-06-11 14:35:21.694621	2026-05-28 14:35:21.694621	\N	\N	1	0.00	0.00	0.00	2026-05-28 14:35:21.694621	2026-05-28 14:35:21.694621
cd15295b-273d-48e7-87c3-43f3fa7952e2	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	trialing	2026-05-28 15:24:08.350458	2026-06-11 15:24:08.350458	2026-05-28 15:24:08.350458	\N	\N	1	0.00	0.00	0.00	2026-05-28 15:24:08.350458	2026-05-28 15:24:08.350458
5e61fd58-ffe9-47ba-a8ab-2e7b4654b28b	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	trialing	2026-05-28 15:24:25.029632	2026-06-11 15:24:25.029632	2026-05-28 15:24:25.029632	\N	\N	1	0.00	0.00	0.00	2026-05-28 15:24:25.029632	2026-05-28 15:24:25.029632
fe1ff16e-596d-4099-aa92-056041f8e4ae	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	trialing	2026-05-29 00:27:29.146365	2026-06-12 00:27:29.146365	2026-05-29 00:27:29.146365	\N	\N	1	0.00	0.00	0.00	2026-05-29 00:27:29.146365	2026-05-29 00:27:29.146365
2ea0ed0f-6d1b-4389-8208-98c6d844b610	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	trialing	2026-05-29 00:27:29.14648	2026-06-12 00:27:29.14648	2026-05-29 00:27:29.14648	\N	\N	1	0.00	0.00	0.00	2026-05-29 00:27:29.14648	2026-05-29 00:27:29.14648
ccfd14d1-74c9-4dbd-a347-bf33b6aa2fc3	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	trialing	2026-05-29 00:30:48.168999	2026-06-12 00:30:48.168999	2026-05-29 00:30:48.168999	\N	\N	1	0.00	0.00	0.00	2026-05-29 00:30:48.168999	2026-05-29 00:30:48.168999
6cd74912-8a4c-43d1-a874-65b734380331	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	trialing	2026-05-29 00:43:41.319695	2026-06-12 00:43:41.319695	2026-05-29 00:43:41.319695	\N	\N	1	0.00	0.00	0.00	2026-05-29 00:43:41.319695	2026-05-29 00:43:41.319695
ccdc8885-5143-4da3-8e40-79883a729d6a	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	trialing	2026-05-29 00:56:33.775937	2026-06-12 00:56:33.775937	2026-05-29 00:56:33.775937	\N	\N	1	0.00	0.00	0.00	2026-05-29 00:56:33.775937	2026-05-29 00:56:33.775937
cd48f099-b6de-4870-9460-935a04de0588	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	trialing	2026-05-29 02:14:17.252782	2026-06-12 02:14:17.252782	2026-05-29 02:14:17.252782	\N	\N	1	0.00	0.00	0.00	2026-05-29 02:14:17.252782	2026-05-29 02:14:17.252782
87429b82-7150-4a65-af81-1d0cf7631e50	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	trialing	2026-05-29 02:14:33.052728	2026-06-12 02:14:33.052728	2026-05-29 02:14:33.052728	\N	\N	1	0.00	0.00	0.00	2026-05-29 02:14:33.052728	2026-05-29 02:14:33.052728
ce8d66b4-2c8a-413b-afcd-b199105307b6	e1811769-e50e-4b03-be07-16f0057b5749	\N	trialing	2026-05-29 08:53:40.223997	2026-06-12 08:53:40.223997	2026-05-29 08:53:40.223997	\N	\N	1	0.00	0.00	0.00	2026-05-29 08:53:40.223997	2026-05-29 08:53:40.223997
3c427947-5ca5-45d6-8816-963f33113eae	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	trialing	2026-05-29 10:16:17.116665	2026-06-12 10:16:17.116665	2026-05-29 10:16:17.116665	\N	\N	1	0.00	0.00	0.00	2026-05-29 10:16:17.116665	2026-05-29 10:16:17.116665
af5e308c-3b91-42ae-b3ac-ba607873ce40	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	trialing	2026-05-29 11:03:42.365453	2026-06-12 11:03:42.365453	2026-05-29 11:03:42.365453	\N	\N	1	0.00	0.00	0.00	2026-05-29 11:03:42.365453	2026-05-29 11:03:42.365453
514b1292-f438-471a-89d2-7b67aced04e0	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	trialing	2026-05-29 11:54:24.581514	2026-06-12 11:54:24.581514	2026-05-29 11:54:24.581514	\N	\N	1	0.00	0.00	0.00	2026-05-29 11:54:24.581514	2026-05-29 11:54:24.581514
cb6ffd40-73eb-48f1-9f55-21f24fde551f	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	trialing	2026-05-29 11:54:24.581577	2026-06-12 11:54:24.581577	2026-05-29 11:54:24.581577	\N	\N	1	0.00	0.00	0.00	2026-05-29 11:54:24.581577	2026-05-29 11:54:24.581577
ee1961be-4e32-4c16-935c-eed8786f4e34	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	trialing	2026-05-29 11:54:24.581624	2026-06-12 11:54:24.581624	2026-05-29 11:54:24.581624	\N	\N	1	0.00	0.00	0.00	2026-05-29 11:54:24.581624	2026-05-29 11:54:24.581624
d063d5dc-07e7-4fcf-a90f-d13f3510290e	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	trialing	2026-05-29 11:57:05.406605	2026-06-12 11:57:05.406605	2026-05-29 11:57:05.406605	\N	\N	1	0.00	0.00	0.00	2026-05-29 11:57:05.406605	2026-05-29 11:57:05.406605
be3ca2a2-0aeb-4b57-b3c7-a39cb168ccd3	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	trialing	2026-05-29 12:08:44.677856	2026-06-12 12:08:44.677856	2026-05-29 12:08:44.677856	\N	\N	1	0.00	0.00	0.00	2026-05-29 12:08:44.677856	2026-05-29 12:08:44.677856
f9034269-971c-47f4-8821-bafdf9d189f9	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	trialing	2026-05-29 12:16:24.614002	2026-06-12 12:16:24.614002	2026-05-29 12:16:24.614002	\N	\N	1	0.00	0.00	0.00	2026-05-29 12:16:24.614002	2026-05-29 12:16:24.614002
9845b577-5bdd-4b2c-b28a-513e80ddacdd	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	trialing	2026-05-29 12:24:57.842606	2026-06-12 12:24:57.842606	2026-05-29 12:24:57.842606	\N	\N	1	0.00	0.00	0.00	2026-05-29 12:24:57.842606	2026-05-29 12:24:57.842606
39fdb1c1-3092-4ae0-89ca-ed80850dcb20	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	trialing	2026-05-29 14:13:04.270262	2026-06-12 14:13:04.270262	2026-05-29 14:13:04.270262	\N	\N	1	0.00	0.00	0.00	2026-05-29 14:13:04.270262	2026-05-29 14:13:04.270262
89671e97-9fe7-459b-888b-531215835409	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	trialing	2026-05-29 15:08:08.113421	2026-06-12 15:08:08.113421	2026-05-29 15:08:08.113421	\N	\N	1	0.00	0.00	0.00	2026-05-29 15:08:08.113421	2026-05-29 15:08:08.113421
5fe26ddf-ad1f-43eb-9810-57d55787a992	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	trialing	2026-05-29 15:08:24.243917	2026-06-12 15:08:24.243917	2026-05-29 15:08:24.243917	\N	\N	1	0.00	0.00	0.00	2026-05-29 15:08:24.243917	2026-05-29 15:08:24.243917
1f6f8de7-5efc-4a00-a3c3-daf601b6fcc6	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	trialing	2026-05-29 15:11:41.111629	2026-06-12 15:11:41.111629	2026-05-29 15:11:41.111629	\N	\N	1	0.00	0.00	0.00	2026-05-29 15:11:41.111629	2026-05-29 15:11:41.111629
6addbe87-4bdc-4cca-a61a-4f66ce216567	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	trialing	2026-05-29 16:10:31.413353	2026-06-12 16:10:31.413353	2026-05-29 16:10:31.413353	\N	\N	1	0.00	0.00	0.00	2026-05-29 16:10:31.413353	2026-05-29 16:10:31.413353
2137da94-bf9c-4178-b860-8b334f8fe999	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	trialing	2026-05-29 16:16:13.133417	2026-06-12 16:16:13.133417	2026-05-29 16:16:13.133417	\N	\N	1	0.00	0.00	0.00	2026-05-29 16:16:13.133417	2026-05-29 16:16:13.133417
58333b73-e5f1-4ac6-90d3-1d405da6aefb	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	trialing	2026-05-29 16:16:29.06222	2026-06-12 16:16:29.06222	2026-05-29 16:16:29.06222	\N	\N	1	0.00	0.00	0.00	2026-05-29 16:16:29.06222	2026-05-29 16:16:29.06222
2a0f6fc6-4ee2-41a7-be26-abb9842598ff	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	trialing	2026-05-29 16:54:35.964958	2026-06-12 16:54:35.964958	2026-05-29 16:54:35.964958	\N	\N	1	0.00	0.00	0.00	2026-05-29 16:54:35.964958	2026-05-29 16:54:35.964958
08e0ed04-8866-4bca-856d-3923192f7f3a	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	trialing	2026-05-29 16:54:51.508738	2026-06-12 16:54:51.508738	2026-05-29 16:54:51.508738	\N	\N	1	0.00	0.00	0.00	2026-05-29 16:54:51.508738	2026-05-29 16:54:51.508738
13bcbcc1-37d5-4884-85d4-fb1f3169c4de	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	trialing	2026-05-29 16:59:00.186324	2026-06-12 16:59:00.186324	2026-05-29 16:59:00.186324	\N	\N	1	0.00	0.00	0.00	2026-05-29 16:59:00.186324	2026-05-29 16:59:00.186324
50a2d9c8-6f9f-433d-8289-acb57d467efd	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	trialing	2026-05-29 17:01:02.435778	2026-06-12 17:01:02.435778	2026-05-29 17:01:02.435778	\N	\N	1	0.00	0.00	0.00	2026-05-29 17:01:02.435778	2026-05-29 17:01:02.435778
\.


--
-- Data for Name: organizations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.organizations (id, name, subdomain, logo_url, settings, created_at, is_default, logo, updated_at, deleted_at) FROM stdin;
8ba8388f-9907-486c-9883-3784c2f2f34e	ELS ACADEMY	els-academy	\N	{"theme": "default"}	2026-05-21 17:32:02.179517	t	\N	2026-05-29 18:55:40.134009	\N
e1811769-e50e-4b03-be07-16f0057b5749	Kothnuru	seevi samaj	\N	{}	2026-05-29 08:51:15.766818	f	\N	2026-05-29 08:51:15.766818	\N
\.


--
-- Data for Name: parent_assessments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.parent_assessments (id, parent_user_id, student_user_id, organization_id, behavior_score, focus_score, regularity_score, creativity_score, academic_score, outdoor_activity_score, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: parent_feedback; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.parent_feedback (id, parent_user_id, student_user_id, organization_id, feedback_text, attachment_url, created_at) FROM stdin;
\.


--
-- Data for Name: parent_student_links; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.parent_student_links (id, parent_user_id, student_user_id, organization_id, created_at) FROM stdin;
684aa1d1-42c0-4f9c-888f-8dc2d16758e7	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	fe400696-c6f1-4122-b97e-c7f825f39d25	8ba8388f-9907-486c-9883-3784c2f2f34e	2026-05-22 00:16:15.622689
174e7db0-0e32-4533-907d-67070c337878	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	cb09b4e0-9caf-46d2-92a5-ec65452200d4	8ba8388f-9907-486c-9883-3784c2f2f34e	2026-05-22 00:16:15.622689
a9bd9209-13c3-40b4-8183-e6b752c59cde	b2b8e045-2b56-46a6-ac1e-77b19b4ba586	3d074d19-5d5d-46fa-b43c-9f1c9f257983	8ba8388f-9907-486c-9883-3784c2f2f34e	2026-05-29 12:21:54.90737
\.


--
-- Data for Name: question_attempts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.question_attempts (id, attempt_id, question_id, is_correct, response_data, time_spent_seconds) FROM stdin;
391684c6-41c8-4d70-886c-ef1b3ad08691	f4cc0ed2-6935-4548-a5ed-f35a294092f4	2060edc3-9e38-4a7b-8648-73c9762a2298	t	{"selected_id": "elephant"}	10
e798f14b-9cf1-4ea2-a53c-83df38a8945a	f4cc0ed2-6935-4548-a5ed-f35a294092f4	610827f0-8f37-4f0b-a525-20003ade0d9c	t	{"selected_ids": ["lion"]}	10
25b5491f-9b78-4fa6-9a56-8081f356a021	f4cc0ed2-6935-4548-a5ed-f35a294092f4	97cf28eb-868b-4595-a43b-b9e560419902	t	{"selected_ids": ["true"]}	10
ec9fc626-c2c0-43d6-a2c3-5d860e8d83e0	f4cc0ed2-6935-4548-a5ed-f35a294092f4	7242ec34-6403-44f8-a676-655cd9ea7175	t	{"selected_ids": ["apple"]}	10
09f29e82-e952-4ba5-bcc4-1eb172b528d3	f4cc0ed2-6935-4548-a5ed-f35a294092f4	7d6e2ff5-b39a-4cbd-b964-4565d703bfc9	t	{"selected_ids": ["a", "e"]}	10
6d6cbf35-23ad-4f6b-b767-c3e4ec554f95	f4cc0ed2-6935-4548-a5ed-f35a294092f4	f0fc773f-8a77-4c2c-9a53-6f9e8263c67f	t	{"matches": [{"item": "lion", "target": "lion", "is_correct": true}, {"item": "duck", "target": "duck", "is_correct": true}, {"item": "owl", "target": "owl", "is_correct": true}]}	10
ab38a136-6cad-47cf-9133-196fe17690d4	73c69bb3-b346-478b-bd57-54bbc954a828	ed146a42-ab7c-4584-a997-56a75daaf4a8	t	{"selected_id": "sing"}	10
93c0ceed-5620-468a-9c1e-200dfc38d78c	eef2ebd0-1aac-439c-a30a-26c5c3580e5e	2060edc3-9e38-4a7b-8648-73c9762a2298	t	{"selected_id": "elephant"}	10
bf94cad6-31ff-42c0-a805-731533a49b95	eef2ebd0-1aac-439c-a30a-26c5c3580e5e	610827f0-8f37-4f0b-a525-20003ade0d9c	t	{"selected_ids": ["lion"]}	10
428cef00-378d-4eaa-baa9-ceed75771670	eef2ebd0-1aac-439c-a30a-26c5c3580e5e	97cf28eb-868b-4595-a43b-b9e560419902	t	{"selected_ids": ["true"]}	10
bf61f7de-1216-41cc-8545-4eeca19ffd10	eef2ebd0-1aac-439c-a30a-26c5c3580e5e	7242ec34-6403-44f8-a676-655cd9ea7175	t	{"selected_ids": ["apple"]}	10
26b3fc0b-e718-47cb-9be1-9dc8915abe13	eef2ebd0-1aac-439c-a30a-26c5c3580e5e	7d6e2ff5-b39a-4cbd-b964-4565d703bfc9	f	{"selected_ids": ["a"]}	10
8731116f-cab8-4a35-a9bd-8b12d591e04c	eef2ebd0-1aac-439c-a30a-26c5c3580e5e	f0fc773f-8a77-4c2c-9a53-6f9e8263c67f	t	{"matches": [{"item": "lion", "target": "lion", "is_correct": true}, {"item": "duck", "target": "duck", "is_correct": true}, {"item": "owl", "target": "owl", "is_correct": true}]}	10
1fb3ba33-4b3b-4fa3-84eb-2cd2deb87439	83b6390f-d34d-4c4b-81e0-0d836918eb31	2060edc3-9e38-4a7b-8648-73c9762a2298	t	{"selected_id": "elephant"}	10
3b123ad4-9e3c-4326-9319-a7a7d7a44f3d	83b6390f-d34d-4c4b-81e0-0d836918eb31	610827f0-8f37-4f0b-a525-20003ade0d9c	t	{"selected_ids": ["lion"]}	10
eb985dd6-22b7-4fdd-8d3f-c7837680220f	83b6390f-d34d-4c4b-81e0-0d836918eb31	97cf28eb-868b-4595-a43b-b9e560419902	t	{"selected_ids": ["true"]}	10
e5de1a70-9619-4945-8128-002cf2ef5567	83b6390f-d34d-4c4b-81e0-0d836918eb31	7242ec34-6403-44f8-a676-655cd9ea7175	t	{"selected_ids": ["apple"]}	10
2ce7733d-f5dd-43d6-a80c-0d7a87b725e3	83b6390f-d34d-4c4b-81e0-0d836918eb31	7d6e2ff5-b39a-4cbd-b964-4565d703bfc9	t	{"selected_ids": ["a", "e"]}	10
49a3143b-d6f3-4774-9cdb-05227be3fcab	83b6390f-d34d-4c4b-81e0-0d836918eb31	f0fc773f-8a77-4c2c-9a53-6f9e8263c67f	t	{"matches": [{"item": "lion", "target": "lion", "is_correct": true}, {"item": "duck", "target": "duck", "is_correct": true}, {"item": "owl", "target": "owl", "is_correct": true}]}	10
4d7bef4c-0d61-4bcd-8df4-c4239a7c0e10	854e80d3-c383-40d9-8fe7-5ba301b18f7b	2060edc3-9e38-4a7b-8648-73c9762a2298	t	{"selected_id": "elephant"}	10
0ff1b168-a3e7-4bae-b46c-227d87ef71e5	854e80d3-c383-40d9-8fe7-5ba301b18f7b	610827f0-8f37-4f0b-a525-20003ade0d9c	t	{"selected_ids": ["lion"]}	10
4f7bcdf2-1483-40c0-8b3e-047fce16df5a	854e80d3-c383-40d9-8fe7-5ba301b18f7b	97cf28eb-868b-4595-a43b-b9e560419902	t	{"selected_ids": ["true"]}	10
e16f5dfe-5c11-4efa-a770-625f77dd969e	854e80d3-c383-40d9-8fe7-5ba301b18f7b	7242ec34-6403-44f8-a676-655cd9ea7175	f	{"selected_ids": ["cat"]}	10
abe557f2-b179-438e-a1a7-affd730d8ac0	854e80d3-c383-40d9-8fe7-5ba301b18f7b	7d6e2ff5-b39a-4cbd-b964-4565d703bfc9	t	{"selected_ids": ["a", "e"]}	10
749447b5-db9e-45d0-a642-b1b24c8eb98f	854e80d3-c383-40d9-8fe7-5ba301b18f7b	f0fc773f-8a77-4c2c-9a53-6f9e8263c67f	t	{"matches": [{"item": "lion", "target": "lion", "is_correct": true}, {"item": "duck", "target": "duck", "is_correct": true}, {"item": "owl", "target": "owl", "is_correct": true}]}	10
98182faf-6930-4472-b014-cb972ab66ed8	11764a1e-63d4-4cbd-b075-f74091642a88	2060edc3-9e38-4a7b-8648-73c9762a2298	t	{"selected_id": "elephant"}	10
2d5ef322-82f6-4795-a93f-f468f0d2c4d9	11764a1e-63d4-4cbd-b075-f74091642a88	610827f0-8f37-4f0b-a525-20003ade0d9c	f	{"selected_ids": ["tiger"]}	10
36e4093f-a513-4c52-a226-0c2c97801db2	11764a1e-63d4-4cbd-b075-f74091642a88	97cf28eb-868b-4595-a43b-b9e560419902	f	{"selected_ids": ["false"]}	10
525b4cc9-ff7e-41a1-b7d3-33a593cb8078	11764a1e-63d4-4cbd-b075-f74091642a88	7242ec34-6403-44f8-a676-655cd9ea7175	t	{"selected_ids": ["apple"]}	10
3a35b386-d50a-411c-987b-b9563f672227	11764a1e-63d4-4cbd-b075-f74091642a88	7d6e2ff5-b39a-4cbd-b964-4565d703bfc9	t	{"selected_ids": ["a", "e"]}	10
8c8299d9-4a10-4cf9-91bb-f7615b722144	11764a1e-63d4-4cbd-b075-f74091642a88	f0fc773f-8a77-4c2c-9a53-6f9e8263c67f	f	{"matches": [{"item": "lion", "target": "lion", "is_correct": true}, {"item": "owl", "target": "duck", "is_correct": false}, {"item": "duck", "target": "owl", "is_correct": false}]}	10
096c7500-3209-4701-a92d-fe3d56ea668a	a29881ea-4bf1-4b22-8917-926912fe2fa6	2060edc3-9e38-4a7b-8648-73c9762a2298	t	{"selected_id": "elephant"}	10
196dd457-6f42-472d-b7fa-5eca52419e0e	a29881ea-4bf1-4b22-8917-926912fe2fa6	610827f0-8f37-4f0b-a525-20003ade0d9c	f	{"selected_ids": ["tiger"]}	10
e3b0f8f6-fc8a-417c-947b-e03988d72c0f	a29881ea-4bf1-4b22-8917-926912fe2fa6	97cf28eb-868b-4595-a43b-b9e560419902	f	{"selected_ids": ["false"]}	10
0af8ee2c-05dd-410c-bf43-7e6086c08611	a29881ea-4bf1-4b22-8917-926912fe2fa6	7242ec34-6403-44f8-a676-655cd9ea7175	t	{"selected_ids": ["apple"]}	10
c2ee9b19-4d7d-42fb-912e-b7d91f5602ed	a29881ea-4bf1-4b22-8917-926912fe2fa6	7d6e2ff5-b39a-4cbd-b964-4565d703bfc9	t	{"selected_ids": ["a", "e"]}	10
284ca7dd-b464-4687-bef0-b0c21b3255f7	a29881ea-4bf1-4b22-8917-926912fe2fa6	f0fc773f-8a77-4c2c-9a53-6f9e8263c67f	f	{"matches": [{"item": "lion", "target": "lion", "is_correct": true}, {"item": "owl", "target": "duck", "is_correct": false}, {"item": "duck", "target": "owl", "is_correct": false}]}	10
80872a74-bd24-4681-a93c-ad3f6a33befd	a29881ea-4bf1-4b22-8917-926912fe2fa6	f0fc773f-8a77-4c2c-9a53-6f9e8263c67f	f	{"matches": [{"item": "lion", "target": "lion", "is_correct": true}, {"item": "owl", "target": "duck", "is_correct": false}, {"item": "duck", "target": "owl", "is_correct": false}]}	10
b3e07438-7a59-4f64-af4f-f999c8024393	5d4d8583-63c2-4249-a9d6-deb506efe6f8	ed146a42-ab7c-4584-a997-56a75daaf4a8	t	{"selected_id": "sing"}	10
458ab694-1b9d-47f0-bb74-da37e58b801b	cf35dd45-991f-423d-a812-93f5c6deaceb	d02647c0-af61-451a-82fb-26183f425317	t	{"selected_id": "elephant"}	10
15ec2a9d-cddd-4f46-a538-22e98fb4e68f	cf35dd45-991f-423d-a812-93f5c6deaceb	a5dc786c-fab7-447c-bdb6-7520508b6de6	f	{"selected_id": "crow"}	10
0f588ae7-5826-473c-bd4e-91bbe283b418	1d2c1421-4c1a-4951-b4d5-3d539cf5dca3	2060edc3-9e38-4a7b-8648-73c9762a2298	t	{"selected_id": "elephant"}	10
2ab94cd3-11a6-44c4-a337-615874941c15	1d2c1421-4c1a-4951-b4d5-3d539cf5dca3	610827f0-8f37-4f0b-a525-20003ade0d9c	t	{"selected_ids": ["lion"]}	10
cf7ea462-b794-4710-acb8-02101a11d59e	1d2c1421-4c1a-4951-b4d5-3d539cf5dca3	97cf28eb-868b-4595-a43b-b9e560419902	t	{"selected_ids": ["true"]}	10
e966a753-942b-4dc7-a86d-04f802eea11b	1d2c1421-4c1a-4951-b4d5-3d539cf5dca3	7242ec34-6403-44f8-a676-655cd9ea7175	f	{"selected_ids": ["cat"]}	10
701a093a-4000-4f59-abea-92c315f979d9	1d2c1421-4c1a-4951-b4d5-3d539cf5dca3	7d6e2ff5-b39a-4cbd-b964-4565d703bfc9	f	{"selected_ids": ["t", "e"]}	10
62e9fa94-2204-432e-8477-ac85e0c4b63f	1d2c1421-4c1a-4951-b4d5-3d539cf5dca3	f0fc773f-8a77-4c2c-9a53-6f9e8263c67f	t	{"matches": [{"item": "lion", "target": "lion", "is_correct": true}, {"item": "duck", "target": "duck", "is_correct": true}, {"item": "owl", "target": "owl", "is_correct": true}]}	10
6e2c66f3-f205-4e37-90ab-ec5397cfe3f2	4fa3f654-336a-4863-a7ed-573feb96c060	2060edc3-9e38-4a7b-8648-73c9762a2298	t	{"selected_id": "elephant"}	10
1888dbb3-3542-48c1-8bf2-3d7068d6e226	4fa3f654-336a-4863-a7ed-573feb96c060	610827f0-8f37-4f0b-a525-20003ade0d9c	t	{"selected_ids": ["lion"]}	10
0ae80ddf-fb38-4906-8f8c-4170df6c586c	4fa3f654-336a-4863-a7ed-573feb96c060	97cf28eb-868b-4595-a43b-b9e560419902	t	{"selected_ids": ["true"]}	10
a2c88969-d6ec-4ff0-be21-ba8c94ef9aec	4fa3f654-336a-4863-a7ed-573feb96c060	7242ec34-6403-44f8-a676-655cd9ea7175	t	{"selected_ids": ["apple"]}	10
bcb05e56-724e-4ad4-ab88-fb9889a94ed2	4fa3f654-336a-4863-a7ed-573feb96c060	7d6e2ff5-b39a-4cbd-b964-4565d703bfc9	t	{"selected_ids": ["a", "e"]}	10
6298b91d-41e2-4b9a-a44e-0f97119393ca	4fa3f654-336a-4863-a7ed-573feb96c060	f0fc773f-8a77-4c2c-9a53-6f9e8263c67f	t	{"matches": [{"item": "lion", "target": "lion", "is_correct": true}, {"item": "duck", "target": "duck", "is_correct": true}, {"item": "owl", "target": "owl", "is_correct": true}]}	10
3ca25167-cd23-43e1-a3e2-6123c7dc6b7b	6b902d83-4b09-4e74-8314-69f004935448	ed146a42-ab7c-4584-a997-56a75daaf4a8	t	{"selected_id": "sing"}	10
0eb2f7fe-c5c5-48af-8324-83a042373a83	8f1b259f-ba9e-4b7f-8e75-614db03c797d	3750fc2c-13b5-4759-a610-96dbc8f144a4	t	{"selected_ids": ["story_2"]}	10
b3efcbd2-f1c2-4899-9d5e-5675e83c8383	4b620fdd-b211-44fb-87da-8c56db597d5b	2060edc3-9e38-4a7b-8648-73c9762a2298	t	{"selected_id": "elephant"}	10
15b4efe3-933c-4541-adf4-29d0e67ffda9	4b620fdd-b211-44fb-87da-8c56db597d5b	610827f0-8f37-4f0b-a525-20003ade0d9c	f	{"selected_ids": ["wolf"]}	10
3aaf3955-5d89-44d7-be9d-7ef9b45cb800	4b620fdd-b211-44fb-87da-8c56db597d5b	97cf28eb-868b-4595-a43b-b9e560419902	t	{"selected_ids": ["true"]}	10
742e5df2-0fd8-4697-9c4a-493408765fe6	4b620fdd-b211-44fb-87da-8c56db597d5b	7242ec34-6403-44f8-a676-655cd9ea7175	f	{"selected_ids": ["ball"]}	10
8b444fbe-8663-452b-b77f-c3c9d8d1fbf3	4b620fdd-b211-44fb-87da-8c56db597d5b	7d6e2ff5-b39a-4cbd-b964-4565d703bfc9	t	{"selected_ids": ["a", "e"]}	10
5af04aba-d324-461e-8416-e51a188c099e	4b620fdd-b211-44fb-87da-8c56db597d5b	f0fc773f-8a77-4c2c-9a53-6f9e8263c67f	t	{"matches": [{"item": "lion", "target": "lion", "is_correct": true}, {"item": "duck", "target": "duck", "is_correct": true}, {"item": "owl", "target": "owl", "is_correct": true}]}	10
f52539c9-9f0b-4d47-99b0-013fb158c8a0	33f1440b-823e-4ed0-b9f5-285bbb3b43ec	d02647c0-af61-451a-82fb-26183f425317	t	{"selected_id": "elephant"}	10
8cf8b13c-a375-411a-8171-d2c350e253cb	33f1440b-823e-4ed0-b9f5-285bbb3b43ec	a5dc786c-fab7-447c-bdb6-7520508b6de6	t	{"selected_id": "owl"}	10
33e9c213-ee73-429d-9fcb-e21aa085a2ce	fa5ea0ed-c34f-44c0-8cfe-bc60404ec71e	2060edc3-9e38-4a7b-8648-73c9762a2298	t	{"selected_id": "elephant"}	10
50558ff0-5c5e-4507-8aa4-f89a7e4fddaa	fa5ea0ed-c34f-44c0-8cfe-bc60404ec71e	610827f0-8f37-4f0b-a525-20003ade0d9c	f	{"selected_ids": ["tiger"]}	10
7a831c67-6887-4682-a92c-57e5ba62443c	fa5ea0ed-c34f-44c0-8cfe-bc60404ec71e	97cf28eb-868b-4595-a43b-b9e560419902	f	{"selected_ids": ["false"]}	10
d737ca2a-105d-4200-a22b-fd86a1e48c16	fa5ea0ed-c34f-44c0-8cfe-bc60404ec71e	7242ec34-6403-44f8-a676-655cd9ea7175	t	{"selected_ids": ["apple"]}	10
fc8d5b1a-e50b-4013-b486-dd300fffe467	fa5ea0ed-c34f-44c0-8cfe-bc60404ec71e	7d6e2ff5-b39a-4cbd-b964-4565d703bfc9	t	{"selected_ids": ["a", "e"]}	10
50d6c5ff-e3e8-4bf8-a949-5eb5f4551eda	fa5ea0ed-c34f-44c0-8cfe-bc60404ec71e	f0fc773f-8a77-4c2c-9a53-6f9e8263c67f	t	{"matches": [{"item": "lion", "target": "lion", "is_correct": true}, {"item": "duck", "target": "duck", "is_correct": true}, {"item": "owl", "target": "owl", "is_correct": true}]}	10
b9744871-42bf-48c9-ad5f-eff1a657d3b8	e26ca835-d8b0-43f6-95e3-e0b1be6f5483	e9eb3e96-cc76-45bb-bbdb-24b1c6cbebb8	f	{"expected": {"red-ring": 10, "blue-ring": 1, "red-solid": 9, "blue-solid": 7, "green-ring": 5, "green-solid": 3, "orange-ring": 8, "yellow-ring": 2, "orange-solid": 4, "yellow-solid": 6}, "showClip": false, "placements": {"1": "blue-solid", "2": "yellow-ring", "3": "green-solid", "4": "red-solid", "5": "orange-solid", "6": "orange-ring", "7": "yellow-solid", "8": "red-ring", "9": "blue-ring", "10": "green-ring"}}	10
2a056202-2ea1-4003-947d-d445728fedc4	5acff8dc-baea-4f13-93fd-40d8e1495698	e9eb3e96-cc76-45bb-bbdb-24b1c6cbebb8	f	{"expected": {"red-ring": 10, "blue-ring": 1, "red-solid": 9, "blue-solid": 7, "green-ring": 5, "green-solid": 3, "orange-ring": 8, "yellow-ring": 2, "orange-solid": 4, "yellow-solid": 6}, "showClip": false, "placements": {"1": "blue-solid", "2": "yellow-ring", "3": "green-solid", "4": "red-solid", "5": "orange-solid", "6": "orange-ring", "7": "yellow-solid", "8": "red-ring", "9": "blue-ring", "10": "green-ring"}}	10
e0800e87-3d06-4d18-9639-8767c3d243c6	5acff8dc-baea-4f13-93fd-40d8e1495698	e9eb3e96-cc76-45bb-bbdb-24b1c6cbebb8	f	{"expected": {"red-ring": 10, "blue-ring": 1, "red-solid": 9, "blue-solid": 7, "green-ring": 5, "green-solid": 3, "orange-ring": 8, "yellow-ring": 2, "orange-solid": 4, "yellow-solid": 6}, "showClip": false, "placements": {"1": "blue-solid", "2": "yellow-ring", "3": "green-solid", "4": "red-solid", "5": "orange-solid", "6": "orange-ring", "7": "yellow-solid", "8": "red-ring", "9": "blue-ring", "10": "green-ring"}}	10
043cfdbf-7522-48ca-9178-60f56234ad19	ce460fc1-8022-41d7-833d-65eca83ca5bf	e9eb3e96-cc76-45bb-bbdb-24b1c6cbebb8	f	{"expected": {"red-ring": 10, "blue-ring": 1, "red-solid": 9, "blue-solid": 7, "green-ring": 5, "green-solid": 3, "orange-ring": 8, "yellow-ring": 2, "orange-solid": 4, "yellow-solid": 6}, "showClip": false, "placements": {"1": "blue-solid", "2": "blue-ring", "3": "yellow-solid", "4": "green-solid", "5": "green-ring", "6": "yellow-ring", "7": "red-ring", "8": "red-solid", "9": "orange-solid", "10": "orange-ring"}}	10
0e66f040-16df-4caa-a988-fd6cadd74531	2ba70364-54b0-4db7-a4c0-04b0f469a5c7	2060edc3-9e38-4a7b-8648-73c9762a2298	t	{"selected_id": "elephant"}	10
8458f97d-ff3f-4420-b966-b55abe6c2802	2ba70364-54b0-4db7-a4c0-04b0f469a5c7	610827f0-8f37-4f0b-a525-20003ade0d9c	t	{"selected_ids": ["lion"]}	10
a04a9d9b-73bd-4bcb-8278-1f7299ff0ede	2ba70364-54b0-4db7-a4c0-04b0f469a5c7	97cf28eb-868b-4595-a43b-b9e560419902	t	{"selected_ids": ["true"]}	10
fef0da90-ed00-45ea-85dd-79b96a21c6ae	2ba70364-54b0-4db7-a4c0-04b0f469a5c7	7242ec34-6403-44f8-a676-655cd9ea7175	t	{"selected_ids": ["apple"]}	10
44db2384-c34c-4fe2-8490-fb2b6521b6c2	2ba70364-54b0-4db7-a4c0-04b0f469a5c7	7d6e2ff5-b39a-4cbd-b964-4565d703bfc9	t	{"selected_ids": ["a", "e"]}	10
b2dc3d55-833a-4680-a855-fe52abbd59aa	2ba70364-54b0-4db7-a4c0-04b0f469a5c7	f0fc773f-8a77-4c2c-9a53-6f9e8263c67f	t	{"matches": [{"item": "lion", "target": "lion", "is_correct": true}, {"item": "duck", "target": "duck", "is_correct": true}, {"item": "owl", "target": "owl", "is_correct": true}]}	10
7d4d1308-b4f1-41ec-a44d-6c7e9c95848c	965880d6-aaed-4b9b-bc59-ada22c53d97c	ed146a42-ab7c-4584-a997-56a75daaf4a8	t	{"selected_id": "sing"}	10
a5e33af2-cdeb-4577-b1e3-a17697443f82	73688090-fbf4-4495-bcc1-988da24b8805	e9eb3e96-cc76-45bb-bbdb-24b1c6cbebb8	f	{"expected": {"red-ring": 10, "blue-ring": 1, "red-solid": 9, "blue-solid": 7, "green-ring": 5, "green-solid": 3, "orange-ring": 8, "yellow-ring": 2, "orange-solid": 4, "yellow-solid": 6}, "showClip": false, "placements": {"1": "red-solid", "2": "orange-ring", "3": "blue-solid", "4": "green-solid", "5": "orange-solid", "6": "red-ring", "7": "green-ring", "8": "blue-ring", "9": "yellow-ring", "10": "yellow-solid"}}	10
9cc48318-4db0-41f4-9174-a0b82ffc65e9	715fdee9-1f7b-477c-9dfb-9bb65101d7f1	e9eb3e96-cc76-45bb-bbdb-24b1c6cbebb8	f	{"expected": {"red-ring": 10, "blue-ring": 1, "red-solid": 9, "blue-solid": 7, "green-ring": 5, "green-solid": 3, "orange-ring": 8, "yellow-ring": 2, "orange-solid": 4, "yellow-solid": 6}, "showClip": false, "placements": {"1": "red-solid", "2": "orange-ring", "3": "blue-solid", "4": "green-solid", "5": "orange-solid", "6": "red-ring", "7": "green-ring", "8": "blue-ring", "9": "yellow-ring", "10": "yellow-solid"}}	10
ffa14516-1777-4eeb-ac21-3184f1377875	715fdee9-1f7b-477c-9dfb-9bb65101d7f1	e9eb3e96-cc76-45bb-bbdb-24b1c6cbebb8	f	{"expected": {"red-ring": 10, "blue-ring": 1, "red-solid": 9, "blue-solid": 7, "green-ring": 5, "green-solid": 3, "orange-ring": 8, "yellow-ring": 2, "orange-solid": 4, "yellow-solid": 6}, "showClip": false, "placements": {"1": "red-solid", "2": "orange-ring", "3": "blue-solid", "4": "green-solid", "5": "orange-solid", "6": "red-ring", "7": "green-ring", "8": "blue-ring", "9": "yellow-ring", "10": "yellow-solid"}}	10
530e9169-b2dc-4496-b518-8556ae1b3158	2e1f5cb7-8a69-4a13-855d-864665e18922	2060edc3-9e38-4a7b-8648-73c9762a2298	t	{"selected_id": "elephant"}	10
17b3c6e6-c3c5-4124-88dc-a39e8bcbda51	2e1f5cb7-8a69-4a13-855d-864665e18922	610827f0-8f37-4f0b-a525-20003ade0d9c	t	{"selected_ids": ["lion"]}	10
9fe42b31-1e00-408e-9c51-c051efdc0949	2e1f5cb7-8a69-4a13-855d-864665e18922	97cf28eb-868b-4595-a43b-b9e560419902	t	{"selected_ids": ["true"]}	10
ea68052c-abaf-4a36-a061-6d729a4df9cf	2e1f5cb7-8a69-4a13-855d-864665e18922	7242ec34-6403-44f8-a676-655cd9ea7175	t	{"selected_ids": ["apple"]}	10
91c0fd28-6f4a-4c61-b556-0bdea9076f12	2e1f5cb7-8a69-4a13-855d-864665e18922	7d6e2ff5-b39a-4cbd-b964-4565d703bfc9	f	{"selected_ids": ["t"]}	10
636c9426-537f-4894-a2ed-5a53861e2742	2e1f5cb7-8a69-4a13-855d-864665e18922	f0fc773f-8a77-4c2c-9a53-6f9e8263c67f	t	{"matches": [{"item": "lion", "target": "lion", "is_correct": true}, {"item": "duck", "target": "duck", "is_correct": true}, {"item": "owl", "target": "owl", "is_correct": true}]}	10
fb1caba6-5c27-4c10-8d10-12ae63dd0482	835d9ac7-42cc-4b16-bb51-fcb9b52b396b	2060edc3-9e38-4a7b-8648-73c9762a2298	t	{"selected_id": "elephant"}	10
ee770153-47e1-4e4b-a488-e62ee77bfafe	835d9ac7-42cc-4b16-bb51-fcb9b52b396b	610827f0-8f37-4f0b-a525-20003ade0d9c	t	{"selected_ids": ["lion"]}	10
187ad35d-a679-4530-9a2e-0f9f4a65c585	835d9ac7-42cc-4b16-bb51-fcb9b52b396b	97cf28eb-868b-4595-a43b-b9e560419902	f	{"selected_ids": ["false"]}	10
7b995adc-a1d4-4c4c-b58d-ed9ba850d341	835d9ac7-42cc-4b16-bb51-fcb9b52b396b	7242ec34-6403-44f8-a676-655cd9ea7175	t	{"selected_ids": ["apple"]}	10
fac48f6c-f286-47ec-a8db-df9783209f73	835d9ac7-42cc-4b16-bb51-fcb9b52b396b	7d6e2ff5-b39a-4cbd-b964-4565d703bfc9	t	{"selected_ids": ["a", "e"]}	10
330b79b7-fdb7-4420-80c2-51df86dc7130	835d9ac7-42cc-4b16-bb51-fcb9b52b396b	f0fc773f-8a77-4c2c-9a53-6f9e8263c67f	t	{"matches": [{"item": "lion", "target": "lion", "is_correct": true}, {"item": "duck", "target": "duck", "is_correct": true}, {"item": "owl", "target": "owl", "is_correct": true}]}	10
0965fef6-2bef-4e2d-bbab-5baec68885d2	6a8cc402-9d64-4a63-afd9-ca570d10e969	32899dbd-8c52-450a-b104-c44cbf314320	t	{"selected_ids": ["lion"]}	10
2c695651-a7a8-452b-a639-da967b65e431	6a8cc402-9d64-4a63-afd9-ca570d10e969	077e8c7f-1d8b-4f5d-9663-24502896810f	t	{"selected_ids": ["dog"]}	10
c6e53a26-a9d8-405d-8666-36eb57680f12	e4f318ec-0255-4878-a35a-a2ad7bc62d34	ed146a42-ab7c-4584-a997-56a75daaf4a8	t	{"selected_id": "sing"}	10
cc577401-bd80-4008-a0db-2392e2fef749	d5cfad8d-676d-4ea6-a737-56d309c72fe3	56ad538f-aa0d-499a-93a2-5e95e8ae7c39	t	{"moves": 60, "pairsMatched": 8}	10
630d1b38-a4a7-4be5-98f6-45d7d8e895ac	c1c2e89a-7729-4341-80d0-2c88871cfe9c	56ad538f-aa0d-499a-93a2-5e95e8ae7c39	t	{"moves": 26, "pairsMatched": 6}	10
ebf7e7be-147a-4d45-8f67-c1445fd8950b	d278c06e-0823-4fb1-addd-ddb005c1e706	56ad538f-aa0d-499a-93a2-5e95e8ae7c39	f	{"accuracy": 50, "completed": false, "clickLimit": 20, "clicksUsed": 20, "totalPairs": 6, "pairsMatched": 3, "wrongAttempts": 7, "correctMatches": [{"label": "Anteater", "pairId": 3, "imageUrl": "/media/memory-assets/anteater-svgrepo-com.svg"}, {"label": "Milk", "pairId": 1, "imageUrl": "/media/memory-assets/milk-svgrepo-com.svg"}, {"label": "Soda", "pairId": 6, "imageUrl": "/media/memory-assets/soda-water-svgrepo-com.svg"}]}	10
0b5e1f9f-d437-4c2d-82ae-ffd94eb9259a	60ea725e-e3b6-4843-a305-e51e777f09ae	56ad538f-aa0d-499a-93a2-5e95e8ae7c39	f	{"accuracy": 17, "completed": false, "clickLimit": 20, "clicksUsed": 20, "totalPairs": 6, "pairsMatched": 1, "wrongAttempts": 9, "correctMatches": [{"label": "Soda", "pairId": 6, "imageUrl": "/media/memory-assets/soda-water-svgrepo-com.svg"}]}	10
5aebcb2c-45f1-47a0-acd1-e89863ca4a4e	f313e257-1bb8-4c3e-abfb-cf51255454a6	56ad538f-aa0d-499a-93a2-5e95e8ae7c39	f	{"accuracy": 33, "completed": false, "clickLimit": 20, "clicksUsed": 20, "totalPairs": 6, "pairsMatched": 2, "wrongAttempts": 8, "correctMatches": [{"label": "Anteater", "pairId": 3, "imageUrl": "/media/memory-assets/anteater-svgrepo-com.svg"}, {"label": "Milk", "pairId": 1, "imageUrl": "/media/memory-assets/milk-svgrepo-com.svg"}]}	10
f71a0eca-d36b-4e53-9404-ed03cb0b1d37	31c7f9eb-7ef9-483d-9c79-5fec9af5ebc8	56ad538f-aa0d-499a-93a2-5e95e8ae7c39	t	{"accuracy": 50, "completed": false, "clickLimit": 20, "clicksUsed": 20, "totalPairs": 6, "pairsMatched": 3, "wrongAttempts": 7, "correctMatches": [{"label": "Anteater", "pairId": 3, "imageUrl": "/media/memory-assets/anteater-svgrepo-com.svg"}, {"label": "Soda", "pairId": 6, "imageUrl": "/media/memory-assets/soda-water-svgrepo-com.svg"}, {"label": "Camel", "pairId": 4, "imageUrl": "/media/memory-assets/camel-svgrepo-com.svg"}]}	10
1c75b170-d4d8-4fc0-82d1-59480037fff4	417cae2a-119c-42cb-a0da-6aee27c337e2	56ad538f-aa0d-499a-93a2-5e95e8ae7c39	f	{"accuracy": 50, "completed": false, "clickLimit": 20, "clicksUsed": 20, "totalPairs": 6, "pairsMatched": 3, "wrongAttempts": 7, "correctMatches": [{"label": "Spider", "pairId": 5, "imageUrl": "/media/memory-assets/spider-svgrepo-com.svg"}, {"label": "Boxing", "pairId": 2, "imageUrl": "/media/memory-assets/boxing-svgrepo-com.svg"}, {"label": "Anteater", "pairId": 3, "imageUrl": "/media/memory-assets/anteater-svgrepo-com.svg"}]}	10
a8f5c835-107c-4103-be1d-6cf8b4da9ffe	8b4dd6e6-063a-402e-a527-81070d8625ea	56ad538f-aa0d-499a-93a2-5e95e8ae7c39	f	{"accuracy": 33, "completed": false, "clickLimit": 20, "clicksUsed": 20, "totalPairs": 6, "pairsMatched": 2, "wrongAttempts": 8, "correctMatches": [{"label": "Boxing", "pairId": 2, "imageUrl": "/media/memory-assets/boxing-svgrepo-com.svg"}, {"label": "Soda", "pairId": 6, "imageUrl": "/media/memory-assets/soda-water-svgrepo-com.svg"}]}	10
8791315b-e158-46cc-aa36-b1e54513c683	d744b99a-1723-4147-92f7-58e8cf563be7	0a90d6dc-309f-443f-8a8d-5b28e9d01572	f	{"answer": "Fruit", "selected": "Juice", "isCorrect": false}	10
7b179065-d876-46e5-b2df-21ddd6cd7a74	f1980cb6-f39d-459f-a7bb-e420dc27ca46	0a90d6dc-309f-443f-8a8d-5b28e9d01572	t	{"answer": "Fruit", "selected": "Fruit", "isCorrect": true}	10
2aa83d4c-05f4-4e4f-8696-34f2ce720004	33466de4-8562-4510-82de-ff38b5cb53a2	0a90d6dc-309f-443f-8a8d-5b28e9d01572	f	{"answer": "Fruit", "selected": "Juice", "isCorrect": false}	10
21f324d1-4b8e-48db-a1c6-ada2e043d5a3	208260af-a925-43b2-96ba-0708b7d0881e	5776e08e-c2aa-43d9-98b0-bea9c880d64a	f	{"expected": {"red-ring": 9, "blue-ring": 7, "red-solid": 2, "blue-solid": 5, "green-ring": 10, "green-solid": 1, "orange-ring": 8, "yellow-ring": 4, "orange-solid": 3, "yellow-solid": 6}, "placements": {"1": "blue-solid", "2": "yellow-ring", "3": "orange-solid", "4": "red-solid", "5": "green-solid", "6": "yellow-solid", "7": "green-ring", "8": "red-ring", "9": "blue-ring", "10": "orange-ring"}, "totalSlots": 10, "correctCount": 2}	10
7e52bd7f-6767-4359-b47a-8a20edb23967	948375fd-069f-4e4d-be0a-9140ee9b652d	5776e08e-c2aa-43d9-98b0-bea9c880d64a	f	{"expected": {"red-ring": 9, "blue-ring": 7, "red-solid": 2, "blue-solid": 5, "green-ring": 10, "green-solid": 1, "orange-ring": 8, "yellow-ring": 4, "orange-solid": 3, "yellow-solid": 6}, "placements": {"1": "blue-solid", "2": "yellow-ring", "3": "orange-solid", "4": "red-solid", "5": "green-solid", "6": "yellow-solid", "7": "green-ring", "8": "red-ring", "9": "blue-ring", "10": "orange-ring"}, "totalSlots": 10, "correctCount": 2}	10
01e893f6-7297-4465-b7e6-8521349cc34a	948375fd-069f-4e4d-be0a-9140ee9b652d	5776e08e-c2aa-43d9-98b0-bea9c880d64a	f	{"expected": {"red-ring": 9, "blue-ring": 7, "red-solid": 2, "blue-solid": 5, "green-ring": 10, "green-solid": 1, "orange-ring": 8, "yellow-ring": 4, "orange-solid": 3, "yellow-solid": 6}, "placements": {"1": "blue-solid", "2": "yellow-ring", "3": "orange-solid", "4": "red-solid", "5": "green-solid", "6": "yellow-solid", "7": "green-ring", "8": "red-ring", "9": "blue-ring", "10": "orange-ring"}, "totalSlots": 10, "correctCount": 2}	10
ab33d957-e7ec-4f94-9994-98d3a7f47208	3fa229d0-1a67-45bf-bcc3-eaf5337c4140	3fa7fea6-7fff-422a-ac8a-5d0b76e1519a	t	{"accuracy": 100, "completed": true, "clickLimit": 10, "clicksUsed": 4, "totalPairs": 2, "pairsMatched": 2, "wrongAttempts": 0, "correctMatches": [{"label": "Circle", "pairId": 1, "imageUrl": "/media/memory-assets/cat-svgrepo-com.svg"}, {"label": "Triangle", "pairId": 2, "imageUrl": "/media/memory-assets/dog-svgrepo-com.svg"}]}	10
09039a7c-6b05-4534-a634-26422303e734	796725da-3551-4244-85d4-6bbfecc887f9	5776e08e-c2aa-43d9-98b0-bea9c880d64a	f	{"expected": {"red-ring": 9, "blue-ring": 7, "red-solid": 2, "blue-solid": 5, "green-ring": 10, "green-solid": 1, "orange-ring": 8, "yellow-ring": 4, "orange-solid": 3, "yellow-solid": 6}, "placements": {"1": "blue-solid", "2": "yellow-solid", "3": "blue-ring", "4": "red-solid", "5": "yellow-ring", "6": "green-solid", "7": "red-ring", "8": "green-ring", "9": "orange-solid", "10": "orange-ring"}, "totalSlots": 10, "correctCount": 0}	10
1ebbb5ca-ddaf-4bf4-b8e5-4c259923c3cd	8b1ba156-668c-4f98-bf0e-e724b0a45a11	ed146a42-ab7c-4584-a997-56a75daaf4a8	t	{"selected_id": "sing"}	10
08b7b933-cda4-45c1-bd92-ba06f2f3bbc1	2e1d87f2-c996-4d79-a272-3226e4a4ec9a	56ad538f-aa0d-499a-93a2-5e95e8ae7c39	f	{"accuracy": 50, "completed": false, "clickLimit": 20, "clicksUsed": 20, "totalPairs": 6, "pairsMatched": 3, "wrongAttempts": 7, "correctMatches": [{"label": "Milk", "pairId": 1, "imageUrl": "/media/memory-assets/milk-svgrepo-com.svg"}, {"label": "Boxing", "pairId": 2, "imageUrl": "/media/memory-assets/boxing-svgrepo-com.svg"}, {"label": "Soda", "pairId": 6, "imageUrl": "/media/memory-assets/soda-water-svgrepo-com.svg"}]}	10
28c09dde-1af7-4226-9898-a5d6dab40905	46be96bb-3c4e-447b-8e62-15d57154aa7c	0a90d6dc-309f-443f-8a8d-5b28e9d01572	f	{"answer": "Fruit", "selected": "Juice", "isCorrect": false}	10
8f38eeb5-7e9a-4088-bc5a-2a2536f1c2d8	035ce6a4-1b6f-4648-9318-e1f44afe8b1f	0a90d6dc-309f-443f-8a8d-5b28e9d01572	t	{"answer": "Fruit", "selected": "Fruit", "isCorrect": true}	10
1e186f41-8c6c-4333-b017-c4e6379526ab	961602f7-4927-4ee9-82b6-045107b8942c	6705b07c-070b-4f2d-a8e4-d57108ca460c	t	{"moves": 17, "gridSize": "3x3", "completed": true, "timeTaken": 48, "clickLimit": 20, "difficulty": "medium"}	10
6539e9de-1fdd-4421-b9b9-4eafede8dd88	6ec04e51-4fca-4a2a-9458-bf5443936ed5	6705b07c-070b-4f2d-a8e4-d57108ca460c	f	{"moves": 12, "gridSize": "3x3", "completed": false, "timeTaken": 21, "clickLimit": 20, "difficulty": "medium", "slotArrangement": [0, 4, 2, 8, 6, 5, 1, 3, 7]}	10
f30074ac-0d00-4863-a07e-06b16834b1ac	7831cf28-4835-4460-b6d0-c606d227b32f	8939a12e-62a5-47ed-9926-2002d35ca91c	t	{"selected_id": "opt_cow"}	10
b36880b5-abd0-48c3-b6be-e48211ca8e5e	7831cf28-4835-4460-b6d0-c606d227b32f	b0c52899-7086-4535-bab6-cc1169f0ce06	t	{"selected_ids": ["opt_true"]}	10
20742806-52d6-4b1a-b3d2-7fa6904a8a37	7831cf28-4835-4460-b6d0-c606d227b32f	ca2f5257-e655-4b64-8da9-bba92a8f3267	t	{"matches": [{"item": "a_bird", "target": "h_nest", "is_correct": true}, {"item": "a_dog", "target": "h_kennel", "is_correct": true}, {"item": "a_fish", "target": "h_water", "is_correct": true}]}	10
a288878e-311c-40c5-aa7e-b4dce671205a	7831cf28-4835-4460-b6d0-c606d227b32f	c588096e-5630-4721-a763-68212629ee4f	t	{"selected_ids": ["opt_doctor"]}	10
305de153-01f2-4e83-82c6-aeb6d2d7af2c	7831cf28-4835-4460-b6d0-c606d227b32f	c004bcb0-6c6f-414d-9f57-eaac7923fb03	t	{"accuracy": 100, "completed": true, "clickLimit": 10, "clicksUsed": 4, "totalPairs": 2, "pairsMatched": 2, "wrongAttempts": 0, "correctMatches": [{"label": "Banana", "pairId": 2, "imageUrl": "https://media.els-ai.in/uploaded/lkg/evs/fruits/banana.png"}, {"label": "Apple", "pairId": 1, "imageUrl": "https://media.els-ai.in/uploaded/lkg/evs/fruits/apple.png"}]}	10
c5884e96-d579-4bbb-9e59-d4e164429d32	7791fdb6-bfde-4989-9b67-0b14d38a2634	8939a12e-62a5-47ed-9926-2002d35ca91c	t	{"selected_id": "opt_cow"}	10
9f4efb2b-09ca-4038-8b17-d45fd615e09a	7791fdb6-bfde-4989-9b67-0b14d38a2634	b0c52899-7086-4535-bab6-cc1169f0ce06	t	{"selected_ids": ["opt_true"]}	10
026672e9-ebef-4e2b-be33-83ec91320231	7791fdb6-bfde-4989-9b67-0b14d38a2634	ca2f5257-e655-4b64-8da9-bba92a8f3267	t	{"matches": [{"item": "a_bird", "target": "h_nest", "is_correct": true}, {"item": "a_dog", "target": "h_kennel", "is_correct": true}, {"item": "a_fish", "target": "h_water", "is_correct": true}]}	10
7b7a3326-2a8b-46d2-90fe-b0ba1dfd1809	7791fdb6-bfde-4989-9b67-0b14d38a2634	c588096e-5630-4721-a763-68212629ee4f	t	{"selected_ids": ["opt_doctor"]}	10
a75b8cdd-6e79-43d0-a895-5ffad2178272	7791fdb6-bfde-4989-9b67-0b14d38a2634	c004bcb0-6c6f-414d-9f57-eaac7923fb03	t	{"accuracy": 100, "completed": true, "clickLimit": 10, "clicksUsed": 8, "totalPairs": 2, "pairsMatched": 2, "wrongAttempts": 2, "correctMatches": [{"label": "Apple", "pairId": 1, "imageUrl": "https://placehold.co/400x400/EEF2FF/4338CA?text=Apple"}, {"label": "Banana", "pairId": 2, "imageUrl": "https://placehold.co/400x400/EEF2FF/4338CA?text=Banana"}]}	10
2ced5fdc-61d0-4427-9680-f859f9587827	7f0a8701-d2d2-4241-8cee-83d3eb92e38a	8939a12e-62a5-47ed-9926-2002d35ca91c	t	{"selected_id": "opt_cow"}	10
09aee005-2341-4e6f-85af-90bec3c55f06	7f0a8701-d2d2-4241-8cee-83d3eb92e38a	b0c52899-7086-4535-bab6-cc1169f0ce06	f	{"selected_ids": ["opt_false"]}	10
76618690-c85c-4dd2-8bd7-6f89619f5e71	7f0a8701-d2d2-4241-8cee-83d3eb92e38a	ca2f5257-e655-4b64-8da9-bba92a8f3267	f	{"matches": [{"item": "a_bird", "target": "h_nest", "is_correct": true}, {"item": "a_fish", "target": "h_kennel", "is_correct": false}, {"item": "a_dog", "target": "h_water", "is_correct": false}]}	10
1388fcca-bd1b-46ff-b705-8e7ceaee45c4	7f0a8701-d2d2-4241-8cee-83d3eb92e38a	c588096e-5630-4721-a763-68212629ee4f	t	{"selected_ids": ["opt_doctor"]}	10
a162b4ef-67f4-438b-a486-cff4d258e084	7f0a8701-d2d2-4241-8cee-83d3eb92e38a	c004bcb0-6c6f-414d-9f57-eaac7923fb03	t	{"accuracy": 100, "completed": true, "clickLimit": 10, "clicksUsed": 4, "totalPairs": 2, "pairsMatched": 2, "wrongAttempts": 0, "correctMatches": [{"label": "Apple", "pairId": 1, "imageUrl": "https://placehold.co/400x400/EEF2FF/4338CA?text=Apple"}, {"label": "Banana", "pairId": 2, "imageUrl": "https://placehold.co/400x400/EEF2FF/4338CA?text=Banana"}]}	10
656d97ba-2aee-4ffc-9f98-458da6cf64b1	0490ef1b-1ebf-4ce8-8291-1d1de6889030	1af776cb-434a-4513-bdd0-5aa226d895e7	t	{"selected_id": "opt_cow"}	10
ff9e8524-124d-4ee2-bb19-79218b859181	0490ef1b-1ebf-4ce8-8291-1d1de6889030	49d97529-f198-4bda-a18c-e5d6590d4240	f	{"selected_ids": ["opt_false"]}	10
b8381e9c-9793-4ccd-8f47-d023950943a3	0490ef1b-1ebf-4ce8-8291-1d1de6889030	63ea59c1-73da-4ccf-896f-be272d3856a4	t	{"matches": [{"item": "a_bird", "target": "h_nest", "is_correct": true}, {"item": "a_dog", "target": "h_kennel", "is_correct": true}, {"item": "a_fish", "target": "h_water", "is_correct": true}]}	10
80da5978-b42f-469e-86f3-173967c61f3c	0490ef1b-1ebf-4ce8-8291-1d1de6889030	4b280b2e-3b2b-4382-8a5d-376f798329c5	t	{"selected_ids": ["opt_doctor"]}	10
3fb31e1f-af8a-4e77-b683-f51556376abd	0490ef1b-1ebf-4ce8-8291-1d1de6889030	5167fbf3-c1b1-41d1-82d9-df80a3fc3765	t	{"accuracy": 100, "completed": true, "clickLimit": 10, "clicksUsed": 8, "totalPairs": 2, "pairsMatched": 2, "wrongAttempts": 2, "correctMatches": [{"label": "Apple", "pairId": 1, "imageUrl": "/media/memory-assets/apple-svgrepo-com.svg"}, {"label": "Banana", "pairId": 2, "imageUrl": "/media/memory-assets/banana-svgrepo-com.svg"}]}	10
669f1e1f-dfec-4659-bc60-b7c7d73afc06	3fa229d0-1a67-45bf-bcc3-eaf5337c4140	e3d3997d-0d3b-4d81-8e88-d2badbbc6272	t	{"answer": "5", "selected": "5", "isCorrect": true}	10
6baeaca0-959a-4e48-83d6-37fc78363419	3fa229d0-1a67-45bf-bcc3-eaf5337c4140	35774f1e-aec3-4f7e-b318-46473f82a155	t	{"selected_id": "opt_circle"}	10
fe37c433-ffd8-476f-a6cd-6c463cc975cd	3fa229d0-1a67-45bf-bcc3-eaf5337c4140	c58c52fa-2a14-498b-a959-45dff733df3a	t	{"selected_ids": ["opt_elephant"]}	10
da0934a6-aae8-4cba-98ac-529d4a85585c	3fa229d0-1a67-45bf-bcc3-eaf5337c4140	9be4f46a-204c-4a7b-b9f3-fa006f8adb87	t	{"matches": [{"item": "d1", "target": "t1", "is_correct": true}, {"item": "d2", "target": "t2", "is_correct": true}, {"item": "d3", "target": "t3", "is_correct": true}]}	10
9b6cb740-47ef-4727-9531-a515eb29ead4	2a427bb2-5af2-48b4-a021-43795b0c8454	d515f3d9-e84e-4a6d-9d10-0ec4600ff61c	t	{"answer": "5", "selected": "5", "isCorrect": true}	10
6f5d408c-6470-41e0-b8e5-4f034acb6ee9	2a427bb2-5af2-48b4-a021-43795b0c8454	5847de8f-8a2e-45d5-856f-003851e5d0c5	t	{"selected_id": "opt_circle"}	10
f75d6c1f-7f2e-4642-8e7d-b0615756111b	2a427bb2-5af2-48b4-a021-43795b0c8454	1ae93eb9-aed6-4abe-b24d-10f0f14c9149	t	{"selected_ids": ["opt_elephant"]}	10
7bc594d2-3db0-47f8-bc12-ff89baba1248	2a427bb2-5af2-48b4-a021-43795b0c8454	16ecc8bf-49f0-45f7-9756-debed8d96599	t	{"matches": [{"item": "d1", "target": "t1", "is_correct": true}, {"item": "d2", "target": "t2", "is_correct": true}, {"item": "d3", "target": "t3", "is_correct": true}]}	10
970fb8a5-6f8e-4211-9a93-a3307af6cbe3	2a427bb2-5af2-48b4-a021-43795b0c8454	5fa90f03-f996-440c-9c81-82280213c2bb	t	{"accuracy": 100, "completed": true, "clickLimit": 10, "clicksUsed": 4, "totalPairs": 2, "pairsMatched": 2, "wrongAttempts": 0, "correctMatches": [{"label": "Triangle", "pairId": 2, "imageUrl": "/media/memory-assets/dog-svgrepo-com.svg"}, {"label": "Circle", "pairId": 1, "imageUrl": "/media/memory-assets/cat-svgrepo-com.svg"}]}	10
7c8086f6-8639-4c68-b422-50310f348a59	c0f9cdbd-2a76-471c-b3a2-ad0173eaf7fe	e3d3997d-0d3b-4d81-8e88-d2badbbc6272	t	{"answer": "circle", "selected": "circle", "isCorrect": true}	10
a2aefe5b-2a72-4f4e-9e16-91c5603539d4	c0f9cdbd-2a76-471c-b3a2-ad0173eaf7fe	35774f1e-aec3-4f7e-b318-46473f82a155	t	{"selected_id": "opt_square"}	10
2db2a8c4-0981-447d-92c4-679886340434	c0f9cdbd-2a76-471c-b3a2-ad0173eaf7fe	c58c52fa-2a14-498b-a959-45dff733df3a	t	{"selected_ids": ["opt_triangle"]}	10
37d8203a-b5f3-4465-b0ce-1b46d14e640d	c0f9cdbd-2a76-471c-b3a2-ad0173eaf7fe	9be4f46a-204c-4a7b-b9f3-fa006f8adb87	t	{"matches": [{"item": "d_circle", "target": "t_circle", "is_correct": true}, {"item": "d_square", "target": "t_square", "is_correct": true}, {"item": "d_triangle", "target": "t_triangle", "is_correct": true}]}	10
ab9f23d6-d2d7-4ba2-9a5c-e43aad59294d	c0f9cdbd-2a76-471c-b3a2-ad0173eaf7fe	3fa7fea6-7fff-422a-ac8a-5d0b76e1519a	t	{"accuracy": 100, "completed": true, "clickLimit": 10, "clicksUsed": 4, "totalPairs": 2, "pairsMatched": 2, "wrongAttempts": 0, "correctMatches": [{"label": "Circle", "pairId": 1, "imageUrl": "/media/images/circle.svg"}, {"label": "Square", "pairId": 2, "imageUrl": "/media/images/square.svg"}]}	10
8c062b98-c1b6-4ab3-80fa-4e9f896c8a69	855cadd2-0212-491a-a046-96a6c4513a34	1af776cb-434a-4513-bdd0-5aa226d895e7	t	{"selected_id": "opt_flower"}	10
fbbaf3c0-d52d-4604-9dfe-7761dd077d07	855cadd2-0212-491a-a046-96a6c4513a34	49d97529-f198-4bda-a18c-e5d6590d4240	t	{"selected_ids": ["opt_true"]}	10
0125e74d-f49c-4687-84fa-4b8de5fb0e2d	855cadd2-0212-491a-a046-96a6c4513a34	63ea59c1-73da-4ccf-896f-be272d3856a4	t	{"matches": [{"item": "d_doctor", "target": "t_doctor", "is_correct": true}, {"item": "d_farmer", "target": "t_farmer", "is_correct": true}, {"item": "d_postman", "target": "t_postman", "is_correct": true}]}	10
4b84c119-e977-4ff1-8fc0-8fa558ad3f41	855cadd2-0212-491a-a046-96a6c4513a34	4b280b2e-3b2b-4382-8a5d-376f798329c5	t	{"selected_ids": ["opt_farmer"]}	10
7f8f1418-5693-4298-ac0b-33c182425871	855cadd2-0212-491a-a046-96a6c4513a34	5167fbf3-c1b1-41d1-82d9-df80a3fc3765	t	{"accuracy": 100, "completed": true, "clickLimit": 10, "clicksUsed": 6, "totalPairs": 2, "pairsMatched": 2, "wrongAttempts": 1, "correctMatches": [{"label": "Grape", "pairId": 2, "imageUrl": "/media/memory-assets/grape-svgrepo-com.svg"}, {"label": "Cherry", "pairId": 1, "imageUrl": "/media/memory-assets/cherry-svgrepo-com.svg"}]}	10
ed8921a7-0850-42ab-b43b-247e322a5f82	d1e00a08-9bde-4942-8b2a-1fedc99adcb8	9c338563-43b8-457a-81c5-6da36e3820df	t	{"selected_ids": ["opt_namaste"]}	10
9c62fef5-6c38-4a90-9746-9e9fa66632af	d1e00a08-9bde-4942-8b2a-1fedc99adcb8	e854e322-527c-4f51-91bb-38b019cd17db	t	{"selected_ids": ["opt_false"]}	10
337ff62c-296f-496a-8ed1-c2215bdf94df	d1e00a08-9bde-4942-8b2a-1fedc99adcb8	8d6ca41f-a793-4d5d-a0bb-6e682ab1bcaa	t	{"matches": [{"item": "d_namaste", "target": "t_respect", "is_correct": true}, {"item": "d_share", "target": "t_share", "is_correct": true}, {"item": "d_help", "target": "t_help", "is_correct": true}]}	10
7bbe973a-af9d-4626-83d5-67b4e3c14458	d1e00a08-9bde-4942-8b2a-1fedc99adcb8	a39af336-7e44-4455-9e08-bfa9389d90eb	t	{"accuracy": 100, "completed": true, "clickLimit": 10, "clicksUsed": 6, "totalPairs": 2, "pairsMatched": 2, "wrongAttempts": 1, "correctMatches": [{"label": "Good Morning", "pairId": 1, "imageUrl": "/media/images/sun.svg"}, {"label": "School Bag", "pairId": 2, "imageUrl": "/media/images/backpack.svg"}]}	10
c2a3a774-d4f0-44c6-a96a-6e718457a304	d1e00a08-9bde-4942-8b2a-1fedc99adcb8	85cc37a0-aadb-4b82-b5da-c201883d050c	t	{"selected_id": "opt_help"}	10
264239c5-fc57-4664-81cd-8abd1e7ca468	58485f2e-3849-4502-8eff-49242b312689	8fbb27be-1ccd-4b25-b74f-dab112fe9a15	t	{"selected_ids": ["opt_bus", "opt_train"]}	10
29a5b364-6bb5-4c9b-b5ed-cf6a83b979b0	58485f2e-3849-4502-8eff-49242b312689	3cc1a21e-7ac7-4148-8cf8-de101448dd68	t	{"selected_ids": ["opt_drum"]}	10
abb20992-4e11-4e8c-a7ee-fe28a670c645	58485f2e-3849-4502-8eff-49242b312689	e7ed66c2-e849-49b0-a4ec-3e53c66787e0	t	{"moves": 6, "gridSize": "2x2", "completed": true, "timeTaken": 16, "clickLimit": 10, "difficulty": "easy", "slotArrangement": [0, 1, 2, null]}	10
5fb57a61-53eb-4244-9765-168363221c2e	58485f2e-3849-4502-8eff-49242b312689	b43c7966-5836-4335-bf6b-a911293d842b	t	{"answer": "road", "selected": "road", "isCorrect": true}	10
79033f71-61f4-450c-ae15-7f3bf8799821	58485f2e-3849-4502-8eff-49242b312689	0a464ace-9147-4883-a51a-119f2650014c	t	{"selected_ids": ["opt_true"]}	10
fe3b35e3-0382-49d0-b4ef-47426209beef	0744f3ff-c7ae-447e-8788-fd52c91f408d	8fbb27be-1ccd-4b25-b74f-dab112fe9a15	f	{"selected_ids": ["opt_bus"]}	10
226e2874-a7e5-4ec3-a66d-7b01bc86488f	0744f3ff-c7ae-447e-8788-fd52c91f408d	3cc1a21e-7ac7-4148-8cf8-de101448dd68	t	{"selected_ids": ["opt_drum"]}	10
60ea6a28-0a85-4149-bfe4-ff3a6b179726	0744f3ff-c7ae-447e-8788-fd52c91f408d	e7ed66c2-e849-49b0-a4ec-3e53c66787e0	t	{"moves": 4, "gridSize": "2x2", "completed": true, "timeTaken": 5, "clickLimit": 10, "difficulty": "easy", "slotArrangement": [null, 1, 2, 3]}	10
78c8e24d-904b-48ca-9c1b-9c38a6029dd0	0744f3ff-c7ae-447e-8788-fd52c91f408d	b43c7966-5836-4335-bf6b-a911293d842b	t	{"answer": "road", "selected": "road", "isCorrect": true}	10
686ec73e-ceb0-4432-9286-abe181cd86c4	0744f3ff-c7ae-447e-8788-fd52c91f408d	0a464ace-9147-4883-a51a-119f2650014c	t	{"selected_ids": ["opt_true"]}	10
e060d966-087a-41f2-9b35-57928fb7772c	4567c71e-ac36-4fa3-b800-9ed10e79022e	ccdeb9cd-e567-4387-a826-b6226ec6f5d3	f	{"selected_ids": ["opt_yellow", "opt_green"]}	10
dba1c85d-a387-40be-a251-d23c849b34f5	4567c71e-ac36-4fa3-b800-9ed10e79022e	6ab133d0-996a-4dd8-966c-8fe3037367a4	t	{"selected_ids": ["opt_dog"]}	10
0976949b-6445-447d-a2de-26097617428d	4567c71e-ac36-4fa3-b800-9ed10e79022e	6a58996c-c7fd-4766-bb94-b8bdf2e757d2	t	{"moves": 4, "gridSize": "2x2", "completed": true, "timeTaken": 6, "clickLimit": 10, "difficulty": "easy", "slotArrangement": [0, 1, null, 3]}	10
85ab597b-ffa3-433e-b8cb-b631dfa6adf4	4567c71e-ac36-4fa3-b800-9ed10e79022e	56969021-fa71-42a7-b24d-7ab876deeac8	t	{"answer": "yellow", "selected": "yellow", "isCorrect": true}	10
620c1ab2-bfff-43fa-a911-e47ba0c48582	4567c71e-ac36-4fa3-b800-9ed10e79022e	a82581a5-d09e-4e3f-8a66-c408c4cad613	t	{"selected_ids": ["opt_true"]}	10
64ca238f-1fbc-42c0-90b7-187e5f1a0309	b7891cac-717c-4292-bb58-0d39b3ac8d15	ccdeb9cd-e567-4387-a826-b6226ec6f5d3	f	{"selected_ids": ["opt_red"]}	10
ef70998a-32d6-45d8-a781-4c9bc38f7bc7	b7891cac-717c-4292-bb58-0d39b3ac8d15	6ab133d0-996a-4dd8-966c-8fe3037367a4	t	{"selected_ids": ["opt_dog"]}	10
7639996d-13ee-485c-8a3a-67d1c08a8ba9	b7891cac-717c-4292-bb58-0d39b3ac8d15	6a58996c-c7fd-4766-bb94-b8bdf2e757d2	f	{"moves": 4, "gridSize": "2x2", "completed": false, "timeTaken": 6, "clickLimit": 10, "difficulty": "easy", "slotArrangement": [1, 3, 0, 2]}	10
ba0ec09a-14c2-46b8-837e-1c2c0fd6f6c0	b7891cac-717c-4292-bb58-0d39b3ac8d15	56969021-fa71-42a7-b24d-7ab876deeac8	t	{"answer": "yellow", "selected": "yellow", "isCorrect": true}	10
ca2af557-e1b9-45a8-a4f3-e4fb53cdbb25	b7891cac-717c-4292-bb58-0d39b3ac8d15	a82581a5-d09e-4e3f-8a66-c408c4cad613	t	{"selected_ids": ["opt_true"]}	10
140bc386-e514-4b7b-b82d-42b5d2566c03	45d56112-4d30-4a32-83e7-a88e7602862b	77a5aa8c-0e42-4e2c-b573-a518c7930a79	t	{"selected_ids": ["opt_mouse"]}	10
1c11084b-f8ff-4606-9e95-42b95760706f	45d56112-4d30-4a32-83e7-a88e7602862b	9db67264-7414-43e8-83f6-d5f164c2b27a	t	{"selected_ids": ["opt_true"]}	10
83975b01-4d64-40ab-a52f-39fac2b8c90b	45d56112-4d30-4a32-83e7-a88e7602862b	85d10e0c-781a-4e9b-92d6-dd38c754a563	t	{"selected_ids": ["opt_net"]}	10
\.


--
-- Data for Name: quiz_questions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.quiz_questions (id, quiz_id, question_type, question_title, question_instruction, question_audio, time_limit_seconds, points, sort_order, question_data, created_at) FROM stdin;
0e510577-6db0-4db9-8ef1-9db50a068fa9	cebd3847-5fea-46e4-9f77-0f125b75b352	drag_drop	Match Animals to Homes	Drag each animal to where it lives!	\N	30	10	1	{"drag_items": [{"id": "lion", "image": "/media/pictures/lion.png", "sound": "/media/sounds/lion.mp3"}, {"id": "duck", "image": "/media/pictures/duck.png", "sound": "/media/sounds/duck.mp3"}, {"id": "owl", "image": "/media/pictures/owl.png", "sound": "/media/sounds/owl.mp3"}], "match_rules": [{"drag_item_id": "lion", "drop_target_id": "lion"}, {"drag_item_id": "duck", "drop_target_id": "duck"}, {"drag_item_id": "owl", "drop_target_id": "owl"}], "drop_targets": [{"id": "lion", "label": "Den (Forest)"}, {"id": "duck", "label": "Pond (Water)"}, {"id": "owl", "label": "Nest (Tree)"}]}	2026-05-21 17:32:02.252783
7a7746b9-1755-4b5a-8c3d-5e6d1442c2aa	ab748380-94f3-4909-8572-2e879c2846ba	image_select	Roar sound!	Listen and tap the animal that makes this sound.	/media/sounds/lion.mp3	30	10	1	{"options": [{"id": "lion", "image": "/media/pictures/lion.png", "label": "Lion", "is_correct": true}, {"id": "dog", "image": "/media/pictures/dog.png", "label": "Dog", "is_correct": false}, {"id": "cat", "image": "/media/pictures/cat.png", "label": "Cat", "is_correct": false}], "prompt_audio": "/media/sounds/lion.mp3"}	2026-05-21 17:32:02.253742
4c35b6d2-bb29-49ca-b088-dfaa1fbf7c14	ab748380-94f3-4909-8572-2e879c2846ba	image_select	Bark sound!	Listen and tap the animal that makes this sound.	/media/sounds/dog.mp3	30	10	2	{"options": [{"id": "cow", "image": "/media/pictures/cow.png", "label": "Cow", "is_correct": false}, {"id": "dog", "image": "/media/pictures/dog.png", "label": "Dog", "is_correct": true}, {"id": "sheep", "image": "/media/pictures/sheep.png", "label": "Sheep", "is_correct": false}], "prompt_audio": "/media/sounds/dog.mp3"}	2026-05-21 17:32:02.253977
37e1ac41-f40f-4172-b4d3-57031aead9f1	ab748380-94f3-4909-8572-2e879c2846ba	image_select	Crow sound!	Listen and tap the animal that makes this sound.	/media/sounds/rooster.mp3	30	10	3	{"options": [{"id": "rooster", "image": "/media/pictures/rooster.png", "label": "Rooster", "is_correct": true}, {"id": "duck", "image": "/media/pictures/duck.png", "label": "Duck", "is_correct": false}, {"id": "pig", "image": "/media/pictures/pig.png", "label": "Pig", "is_correct": false}], "prompt_audio": "/media/sounds/rooster.mp3"}	2026-05-21 17:32:02.254199
b579de87-5c70-408c-87fd-b6d158ac87d6	f3e3aabc-2df0-4496-a324-45cac08f839b	guess_image	Look at the picture	Choose the correct animal name.	\N	30	10	1	{"options": [{"id": "elephant", "image": "/media/pictures/elephant.png", "label": "Elephant", "is_correct": true}, {"id": "lion", "image": "/media/pictures/lion.png", "label": "Lion", "is_correct": false}, {"id": "dog", "image": "/media/pictures/dog.png", "label": "Dog", "is_correct": false}], "variant": "guess_image", "prompt_image": "/media/pictures/elephant.png"}	2026-05-21 17:32:02.254771
523c2ea2-3409-4c8a-a7e6-c498300ca284	f3e3aabc-2df0-4496-a324-45cac08f839b	guess_image	Identify the bird	Which bird is shown in the image?	\N	30	10	2	{"options": [{"id": "owl", "image": "/media/pictures/owl.png", "label": "Owl", "is_correct": true}, {"id": "crow", "image": "/media/pictures/crow.png", "label": "Crow", "is_correct": false}, {"id": "rooster", "image": "/media/pictures/rooster.png", "label": "Rooster", "is_correct": false}], "variant": "guess_image", "prompt_image": "/media/pictures/owl.png"}	2026-05-21 17:32:02.255018
a6ee51f7-2cc2-45a3-8abc-6099d92bd27e	f3e3aabc-2df0-4496-a324-45cac08f839b	guess_image	Look at the animal	What animal is shown here?	\N	30	10	3	{"options": [{"id": "tiger", "image": "/media/pictures/tiger.png", "label": "Tiger", "is_correct": true}, {"id": "cat", "image": "/media/pictures/cat.png", "label": "Cat", "is_correct": false}, {"id": "horse", "image": "/media/pictures/horse.png", "label": "Horse", "is_correct": false}], "variant": "guess_image", "prompt_image": "/media/pictures/tiger.png"}	2026-05-21 17:32:02.255258
0542683d-4214-4d18-8784-ecc95f369e49	079c6e5c-47b5-4af1-b9a8-f8ffdc1a8b92	guess_audio	Listen carefully	Which animal name matches the sound?	/media/sounds/lion.mp3	30	10	1	{"options": [{"id": "lion", "label": "Lion", "is_correct": true}, {"id": "tiger", "label": "Tiger", "is_correct": false}, {"id": "wolf", "label": "Wolf", "is_correct": false}], "variant": "guess_audio", "prompt_audio": "/media/sounds/lion.mp3"}	2026-05-21 17:32:02.255698
068ad4a2-bb86-4bf4-bc3a-22789553b926	079c6e5c-47b5-4af1-b9a8-f8ffdc1a8b92	guess_audio	Listen to the animal	What animal makes this sound?	/media/sounds/dog.mp3	30	10	2	{"options": [{"id": "dog", "label": "Dog", "is_correct": true}, {"id": "cat", "label": "Cat", "is_correct": false}, {"id": "sheep", "label": "Sheep", "is_correct": false}], "variant": "guess_audio", "prompt_audio": "/media/sounds/dog.mp3"}	2026-05-21 17:32:02.255898
21f56457-b8dc-4934-8684-149b616a542f	079c6e5c-47b5-4af1-b9a8-f8ffdc1a8b92	guess_audio	Listen to the audio	Choose the correct word you hear.	/media/sounds/duck.mp3	30	10	3	{"options": [{"id": "duck", "label": "Duck", "is_correct": true}, {"id": "rooster", "label": "Rooster", "is_correct": false}, {"id": "pig", "label": "Pig", "is_correct": false}], "variant": "guess_audio", "prompt_audio": "/media/sounds/duck.mp3"}	2026-05-21 17:32:02.256098
32899dbd-8c52-450a-b104-c44cbf314320	922c6dcc-7ded-4249-9e8f-52b7f56d515e	guess_audio	Listen to the sound	Which word matches the sound you hear?	/media/sounds/lion.mp3	30	10	1	{"options": [{"id": "lion", "label": "Lion", "is_correct": true}, {"id": "tiger", "label": "Tiger", "is_correct": false}, {"id": "wolf", "label": "Wolf", "is_correct": false}], "variant": "guess_audio", "prompt_audio": "/media/sounds/lion.mp3"}	2026-05-21 17:32:02.262974
077e8c7f-1d8b-4f5d-9663-24502896810f	922c6dcc-7ded-4249-9e8f-52b7f56d515e	guess_audio	Listen carefully	Select the correct name of the animal.	/media/sounds/dog.mp3	30	10	2	{"options": [{"id": "dog", "label": "Dog", "is_correct": true}, {"id": "cat", "label": "Cat", "is_correct": false}, {"id": "sheep", "label": "Sheep", "is_correct": false}], "variant": "guess_audio", "prompt_audio": "/media/sounds/dog.mp3"}	2026-05-21 17:32:02.263198
d02647c0-af61-451a-82fb-26183f425317	99f27629-ef10-4db4-badc-fcc19496503d	guess_image	Identify the animal	What is the name of this animal?	\N	30	10	1	{"options": [{"id": "elephant", "image": "/media/pictures/elephant.png", "label": "Elephant", "is_correct": true}, {"id": "lion", "image": "/media/pictures/lion.png", "label": "Lion", "is_correct": false}, {"id": "dog", "image": "/media/pictures/dog.png", "label": "Dog", "is_correct": false}], "variant": "guess_image", "prompt_image": "/media/pictures/elephant.png"}	2026-05-21 17:32:02.263731
a5dc786c-fab7-447c-bdb6-7520508b6de6	99f27629-ef10-4db4-badc-fcc19496503d	guess_image	Name this bird	Choose the correct name for this bird.	\N	30	10	2	{"options": [{"id": "owl", "image": "/media/pictures/owl.png", "label": "Owl", "is_correct": true}, {"id": "crow", "image": "/media/pictures/crow.png", "label": "Crow", "is_correct": false}, {"id": "rooster", "image": "/media/pictures/rooster.png", "label": "Rooster", "is_correct": false}], "variant": "guess_image", "prompt_image": "/media/pictures/owl.png"}	2026-05-21 17:32:02.263956
ed146a42-ab7c-4584-a997-56a75daaf4a8	42848837-bd7f-4e3b-b558-2b2805b16192	guess_image	Identify the Action	What action does the rooster do in the morning?	\N	30	10	1	{"options": [{"id": "sing", "image": "/media/pictures/rooster.png", "label": "Crow/Sing", "is_correct": true}, {"id": "swim", "image": "/media/pictures/duck.png", "label": "Swim", "is_correct": false}, {"id": "fly", "image": "/media/pictures/owl.png", "label": "Fly", "is_correct": false}], "variant": "guess_image", "prompt_image": "/media/pictures/rooster.png"}	2026-05-21 17:32:02.264422
2060edc3-9e38-4a7b-8648-73c9762a2298	f85700b3-faa3-4042-b8c4-c78a31a39610	guess_image	Look at the picture	Choose the correct animal name.	\N	30	10	1	{"options": [{"id": "elephant", "image": "/media/pictures/elephant.png", "label": "Elephant", "is_correct": true}, {"id": "lion", "image": "/media/pictures/lion.png", "label": "Lion", "is_correct": false}, {"id": "dog", "image": "/media/pictures/dog.png", "label": "Dog", "is_correct": false}], "variant": "guess_image", "prompt_image": "/media/pictures/elephant.png"}	2026-05-21 17:32:02.264914
610827f0-8f37-4f0b-a525-20003ade0d9c	f85700b3-faa3-4042-b8c4-c78a31a39610	guess_audio	Listen carefully	Which animal name matches the sound?	/media/sounds/lion.mp3	30	10	2	{"options": [{"id": "lion", "label": "Lion", "is_correct": true}, {"id": "tiger", "label": "Tiger", "is_correct": false}, {"id": "wolf", "label": "Wolf", "is_correct": false}], "variant": "guess_audio", "prompt_audio": "/media/sounds/lion.mp3"}	2026-05-21 17:32:02.265736
97cf28eb-868b-4595-a43b-b9e560419902	f85700b3-faa3-4042-b8c4-c78a31a39610	true_false	Is a dog a pet animal?	Choose True or False.	\N	30	10	3	{"options": [{"id": "true", "label": "True", "is_correct": true}, {"id": "false", "label": "False", "is_correct": false}]}	2026-05-21 17:32:02.265958
7242ec34-6403-44f8-a676-655cd9ea7175	f85700b3-faa3-4042-b8c4-c78a31a39610	single_choice	Which word starts with the letter A?	Choose the correct option.	\N	30	10	4	{"options": [{"id": "apple", "label": "Apple", "is_correct": true}, {"id": "ball", "label": "Ball", "is_correct": false}, {"id": "cat", "label": "Cat", "is_correct": false}, {"id": "dog", "label": "Dog", "is_correct": false}]}	2026-05-21 17:32:02.266173
7d6e2ff5-b39a-4cbd-b964-4565d703bfc9	f85700b3-faa3-4042-b8c4-c78a31a39610	multi_choice	Identify the Vowels	Select all the vowels from the list below.	\N	30	10	5	{"options": [{"id": "a", "label": "A", "is_correct": true}, {"id": "e", "label": "E", "is_correct": true}, {"id": "b", "label": "B", "is_correct": false}, {"id": "t", "label": "T", "is_correct": false}]}	2026-05-21 17:32:02.266388
f0fc773f-8a77-4c2c-9a53-6f9e8263c67f	f85700b3-faa3-4042-b8c4-c78a31a39610	drag_drop_match	Match Animals to Homes	Drag each animal to where it lives!	\N	30	10	6	{"drag_items": [{"id": "lion", "image": "/media/pictures/lion.png", "sound": "/media/sounds/lion.mp3"}, {"id": "duck", "image": "/media/pictures/duck.png", "sound": "/media/sounds/duck.mp3"}, {"id": "owl", "image": "/media/pictures/owl.png", "sound": "/media/sounds/owl.mp3"}], "match_rules": [{"drag_item_id": "lion", "drop_target_id": "lion"}, {"drag_item_id": "duck", "drop_target_id": "duck"}, {"drag_item_id": "owl", "drop_target_id": "owl"}], "drop_targets": [{"id": "lion", "label": "Den (Forest)"}, {"id": "duck", "label": "Pond (Water)"}, {"id": "owl", "label": "Nest (Tree)"}]}	2026-05-21 17:32:02.266611
e8255d18-a6aa-445b-bf47-680758236208	\N	single_choice	What is Panchtantra ?	Choose one correct option.	\N	30	10	\N	{"_meta": {"subject": "Hindi Stories", "creatorId": "2bb3d34c-4eae-46bd-8f24-cf1c9096ac70", "classLevel": "3", "organizationId": "8ba8388f-9907-486c-9883-3784c2f2f34e"}, "options": [{"id": "science_1", "label": "Science", "is_correct": false}, {"id": "story_2", "label": "Story", "is_correct": true}, {"id": "game_3", "label": "Game", "is_correct": false}, {"id": "movie_4", "label": "Movie", "is_correct": false}], "variant": "single_choice"}	2026-05-22 15:58:37.118085
3750fc2c-13b5-4759-a610-96dbc8f144a4	b2afc6d9-df09-4405-8c36-cdff8f3b3b89	single_choice	What is Panchtantra ?	Choose one correct option.	\N	30	0	\N	{"_meta": {"subject": "Hindi Stories", "creatorId": "2bb3d34c-4eae-46bd-8f24-cf1c9096ac70", "classLevel": "3", "organizationId": "8ba8388f-9907-486c-9883-3784c2f2f34e"}, "options": [{"id": "science_1", "label": "Science", "is_correct": false}, {"id": "story_2", "label": "Story", "is_correct": true}, {"id": "game_3", "label": "Game", "is_correct": false}, {"id": "movie_4", "label": "Movie", "is_correct": false}], "variant": "single_choice"}	2026-05-22 16:06:06.076247
67ee5210-9e8d-4ad5-bbd8-a709dcf180d7	\N	logico	Match The Bhagwan	Match each Logico button with the correct option position from top to bottom.	\N	30	10	\N	{"_meta": {"subject": "Hindi Stories", "creatorId": "866bc022-307f-4218-94a3-7622dd2aec79", "classLevel": "3", "organizationId": "8ba8388f-9907-486c-9883-3784c2f2f34e"}, "variant": "logico", "option_slots": [{"id": 1, "value": ""}, {"id": 2, "value": ""}, {"id": 3, "value": ""}, {"id": 4, "value": ""}, {"id": 5, "value": ""}, {"id": 6, "value": ""}, {"id": 7, "value": ""}, {"id": 8, "value": ""}, {"id": 9, "value": ""}, {"id": 10, "value": ""}], "prompt_image": "https://gathjod-emeelan.s3.ap-southeast-2.amazonaws.com/els-media/8ba8388f-9907-486c-9883-3784c2f2f34e/image/2026/05/df49e1f1-57f4-44cb-9f36-82eb050a1c05-Card_Generated.jpg", "logico_buttons": ["red-solid", "green-solid", "blue-solid", "yellow-solid", "orange-solid", "red-ring", "green-ring", "blue-ring", "yellow-ring", "orange-ring"], "button_slot_map": {"red-ring": 10, "blue-ring": 1, "red-solid": 9, "blue-solid": 7, "green-ring": 5, "green-solid": 3, "orange-ring": 8, "yellow-ring": 2, "orange-solid": 4, "yellow-solid": 6}, "prompt_image_asset_id": "5efdd8ed-b772-46dc-87de-4ab52a9c5bdc"}	2026-05-23 14:17:01.153251
b0c52899-7086-4535-bab6-cc1169f0ce06	a1b3d3c5-157f-4f6b-9eb8-9a4101f86b64	true_false	Plants need water	Choose True or False.	\N	20	10	2	{"_meta": {"creatorId": "2bb3d34c-4eae-46bd-8f24-cf1c9096ac70"}, "options": [{"id": "opt_true", "label": "True", "is_correct": true}, {"id": "opt_false", "label": "False", "is_correct": false}]}	2026-05-29 18:32:03.652191
e7ed66c2-e849-49b0-a4ec-3e53c66787e0	9675eec6-48bd-4f79-a82f-43b112d81259	jigsaw	Make the festival star puzzle	Drag pieces to rebuild the star.	\N	60	20	3	{"_meta": {"creatorId": "2bb3d34c-4eae-46bd-8f24-cf1c9096ac70"}, "image": "/media/images/star.svg", "gridSize": "2x2", "clickLimit": 10, "difficulty": "easy"}	2026-05-29 18:32:03.721837
3cc1a21e-7ac7-4148-8cf8-de101448dd68	9675eec6-48bd-4f79-a82f-43b112d81259	guess_audio	Which festival sound is this?	Listen and choose what you hear.	/media/sounds/drum.mp3	30	10	2	{"_meta": {"creatorId": "2bb3d34c-4eae-46bd-8f24-cf1c9096ac70"}, "options": [{"id": "opt_drum", "label": "Drum", "is_correct": true}, {"id": "opt_train", "label": "Train", "is_correct": false}, {"id": "opt_bell", "label": "Bell", "is_correct": false}]}	2026-05-29 18:32:03.718149
e9eb3e96-cc76-45bb-bbdb-24b1c6cbebb8	9a4c3dfd-1f6a-4379-8bd3-790a95781aab	logico	Match The Bhagwan	Match each Logico button with the correct option position from top to bottom.	\N	30	0	\N	{"_meta": {"subject": "Hindi Stories", "creatorId": "866bc022-307f-4218-94a3-7622dd2aec79", "classLevel": "3", "organizationId": "8ba8388f-9907-486c-9883-3784c2f2f34e"}, "variant": "logico", "option_slots": [{"id": 1, "value": ""}, {"id": 2, "value": ""}, {"id": 3, "value": ""}, {"id": 4, "value": ""}, {"id": 5, "value": ""}, {"id": 6, "value": ""}, {"id": 7, "value": ""}, {"id": 8, "value": ""}, {"id": 9, "value": ""}, {"id": 10, "value": ""}], "prompt_image": "https://gathjod-emeelan.s3.ap-southeast-2.amazonaws.com/els-media/8ba8388f-9907-486c-9883-3784c2f2f34e/image/2026/05/df49e1f1-57f4-44cb-9f36-82eb050a1c05-Card_Generated.jpg", "logico_buttons": ["red-solid", "green-solid", "blue-solid", "yellow-solid", "orange-solid", "red-ring", "green-ring", "blue-ring", "yellow-ring", "orange-ring"], "button_slot_map": {"red-ring": 10, "blue-ring": 1, "red-solid": 9, "blue-solid": 7, "green-ring": 5, "green-solid": 3, "orange-ring": 8, "yellow-ring": 2, "orange-solid": 4, "yellow-solid": 6}, "prompt_image_asset_id": "5efdd8ed-b772-46dc-87de-4ab52a9c5bdc"}	2026-05-23 14:21:20.37021
7ab6d226-ac0b-400d-ac4e-7c055f081e99	\N	logico	BodyParts	Match each Logico button with the correct option position from top to bottom.	\N	30	10	\N	{"_meta": {"subject": "Hindi Stories", "creatorId": "2bb3d34c-4eae-46bd-8f24-cf1c9096ac70", "classLevel": "3", "organizationId": "8ba8388f-9907-486c-9883-3784c2f2f34e"}, "variant": "logico", "option_slots": [{"id": 1, "value": ""}, {"id": 2, "value": ""}, {"id": 3, "value": ""}, {"id": 4, "value": ""}, {"id": 5, "value": ""}, {"id": 6, "value": ""}, {"id": 7, "value": ""}, {"id": 8, "value": ""}, {"id": 9, "value": ""}, {"id": 10, "value": ""}], "prompt_image": "https://gathjod-emeelan.s3.ap-southeast-2.amazonaws.com/els-media/8ba8388f-9907-486c-9883-3784c2f2f34e/image/2026/05/2c9702e8-b084-4a19-bbb7-650f3797f03e-5_.jpg", "logico_buttons": ["red-solid", "green-solid", "blue-solid", "yellow-solid", "orange-solid", "red-ring", "green-ring", "blue-ring", "yellow-ring", "orange-ring"], "button_slot_map": {"red-ring": 9, "blue-ring": 7, "red-solid": 2, "blue-solid": 5, "green-ring": 10, "green-solid": 1, "orange-ring": 8, "yellow-ring": 4, "orange-solid": 3, "yellow-solid": 6}, "prompt_image_asset_id": "53c929e5-8211-44d7-84a2-5d1dc7b1599f"}	2026-05-24 17:29:35.59922
5776e08e-c2aa-43d9-98b0-bea9c880d64a	9e6f205f-b471-4400-9691-befa9cc13c9d	logico	BodyParts	Match each Logico button with the correct option position from top to bottom.	\N	30	0	\N	{"_meta": {"subject": "Hindi Stories", "creatorId": "2bb3d34c-4eae-46bd-8f24-cf1c9096ac70", "classLevel": "3", "organizationId": "8ba8388f-9907-486c-9883-3784c2f2f34e"}, "variant": "logico", "option_slots": [{"id": 1, "value": ""}, {"id": 2, "value": ""}, {"id": 3, "value": ""}, {"id": 4, "value": ""}, {"id": 5, "value": ""}, {"id": 6, "value": ""}, {"id": 7, "value": ""}, {"id": 8, "value": ""}, {"id": 9, "value": ""}, {"id": 10, "value": ""}], "prompt_image": "https://gathjod-emeelan.s3.ap-southeast-2.amazonaws.com/els-media/8ba8388f-9907-486c-9883-3784c2f2f34e/image/2026/05/2c9702e8-b084-4a19-bbb7-650f3797f03e-5_.jpg", "logico_buttons": ["red-solid", "green-solid", "blue-solid", "yellow-solid", "orange-solid", "red-ring", "green-ring", "blue-ring", "yellow-ring", "orange-ring"], "button_slot_map": {"red-ring": 9, "blue-ring": 7, "red-solid": 2, "blue-solid": 5, "green-ring": 10, "green-solid": 1, "orange-ring": 8, "yellow-ring": 4, "orange-solid": 3, "yellow-solid": 6}, "prompt_image_asset_id": "53c929e5-8211-44d7-84a2-5d1dc7b1599f"}	2026-05-24 17:32:35.878458
e3d3997d-0d3b-4d81-8e88-d2badbbc6272	5ee076f6-30af-466e-be8c-845ec6c3fe16	fill_blank	Fill the shape	Pick the missing word.	\N	30	10	1	{"hint": "Look at a wheel.", "_meta": {"creatorId": "2bb3d34c-4eae-46bd-8f24-cf1c9096ac70"}, "answer": "circle", "options": ["circle", "square", "triangle", "star"], "sentence": "A ball is round like a ___"}	2026-05-29 18:32:03.549531
b43c7966-5836-4335-bf6b-a911293d842b	9675eec6-48bd-4f79-a82f-43b112d81259	fill_blank	Fill the transport word	Pick the missing word.	\N	25	10	4	{"hint": "Cars and buses use it.", "_meta": {"creatorId": "2bb3d34c-4eae-46bd-8f24-cf1c9096ac70"}, "answer": "road", "options": ["road", "sky", "water", "tree"], "sentence": "A bus runs on the ___"}	2026-05-29 18:32:03.72602
5fa90f03-f996-440c-9c81-82280213c2bb	2be08575-5987-4255-9881-20cf6250be1b	memory_match	Match same shapes	Flip cards and match shape pairs.	\N	45	15	5	{"grid": "2x2", "_meta": {"creatorId": "2bb3d34c-4eae-46bd-8f24-cf1c9096ac70"}, "pairs": [{"id": 1, "label": "Circle", "imageUrl": "/media/memory-assets/cat-svgrepo-com.svg"}, {"id": 2, "label": "Triangle", "imageUrl": "/media/memory-assets/dog-svgrepo-com.svg"}], "clickLimit": 10}	2026-05-29 18:32:03.53849
56ad538f-aa0d-499a-93a2-5e95e8ae7c39	52edaca0-d62c-47cd-a587-6aeccd7eda7f	memory_match	Memory Game	Tap cards to find all matching pairs before time runs out.	\N	30	0	\N	{"grid": "6x6", "_meta": {"subject": "English", "creatorId": "2bb3d34c-4eae-46bd-8f24-cf1c9096ac70", "classLevel": "1", "organizationId": "8ba8388f-9907-486c-9883-3784c2f2f34e"}, "pairs": [{"id": 1, "label": "Milk", "imageUrl": "/media/memory-assets/milk-svgrepo-com.svg"}, {"id": 2, "label": "Boxing", "imageUrl": "/media/memory-assets/boxing-svgrepo-com.svg"}, {"id": 3, "label": "Anteater", "imageUrl": "/media/memory-assets/anteater-svgrepo-com.svg"}, {"id": 4, "label": "Camel", "imageUrl": "/media/memory-assets/camel-svgrepo-com.svg"}, {"id": 5, "label": "Spider", "imageUrl": "/media/memory-assets/spider-svgrepo-com.svg"}, {"id": 6, "label": "Soda", "imageUrl": "/media/memory-assets/soda-water-svgrepo-com.svg"}], "clickLimit": 20}	2026-05-28 23:32:50.311832
288163f5-c751-46c3-8acc-205dbfa20279	\N	fill_blank	Fill in the Blanks	Read the sentence carefully and choose the correct missing word.	\N	30	10	\N	{"hint": "Edible", "_meta": {"subject": "English", "creatorId": "2bb3d34c-4eae-46bd-8f24-cf1c9096ac70", "classLevel": "1", "organizationId": "8ba8388f-9907-486c-9883-3784c2f2f34e"}, "answer": "Fruit", "options": ["Vegetable", "Fruit", "Juice"], "sentence": "Apple Is A ___"}	2026-05-29 01:42:58.947521
0a90d6dc-309f-443f-8a8d-5b28e9d01572	d9ba92a0-cd24-493c-a7a4-be57a6755e61	fill_blank	Fill in the Blanks	Read the sentence carefully and choose the correct missing word.	\N	30	0	\N	{"hint": "Edible", "_meta": {"subject": "English", "creatorId": "2bb3d34c-4eae-46bd-8f24-cf1c9096ac70", "classLevel": "1", "organizationId": "8ba8388f-9907-486c-9883-3784c2f2f34e"}, "answer": "Fruit", "options": ["Vegetable", "Fruit", "Juice"], "sentence": "Apple Is A ___"}	2026-05-29 02:15:36.912487
cd0da82d-c196-4517-8ff0-1ff4fc08a35d	\N	jigsaw	Lion JigSaw	Drag and rearrange pieces until the full image is complete.	\N	30	10	\N	{"_meta": {"subject": "Activity / Play-based Learning", "creatorId": "2bb3d34c-4eae-46bd-8f24-cf1c9096ac70", "classLevel": "LKG", "organizationId": "8ba8388f-9907-486c-9883-3784c2f2f34e"}, "image": "https://gathjod-emeelan.s3.ap-southeast-2.amazonaws.com/els-media/8ba8388f-9907-486c-9883-3784c2f2f34e/image/2026/05/59670b1e-8e45-4496-82f1-d5b7bd6fc596-Lion.jpg", "gridSize": "3x3", "clickLimit": 20, "difficulty": "medium", "image_asset_id": "51662698-83ae-408d-8c2d-5a3478aba56f"}	2026-05-29 14:16:44.091761
916128e2-5ef0-4d81-ab4c-47a54ad67138	8d923268-03f8-40e6-b819-e45fda5c5c18	jigsaw	Lion JigSaw	Drag and rearrange pieces until the full image is complete.	\N	30	0	\N	{"_meta": {"subject": "English", "creatorId": "2bb3d34c-4eae-46bd-8f24-cf1c9096ac70", "classLevel": "1", "organizationId": "8ba8388f-9907-486c-9883-3784c2f2f34e"}, "image": "https://gathjod-emeelan.s3.ap-southeast-2.amazonaws.com/els-media/8ba8388f-9907-486c-9883-3784c2f2f34e/image/2026/05/59670b1e-8e45-4496-82f1-d5b7bd6fc596-Lion.jpg", "gridSize": "3x3", "clickLimit": 20, "difficulty": "medium", "image_asset_id": "51662698-83ae-408d-8c2d-5a3478aba56f"}	2026-05-29 16:02:11.271138
6705b07c-070b-4f2d-a8e4-d57108ca460c	fa7a6f0c-1a53-4f15-bb9d-cc162985a33c	jigsaw	Lion JigSaw	Drag and rearrange pieces until the full image is complete.	\N	30	0	\N	{"_meta": {"subject": "English", "creatorId": "2bb3d34c-4eae-46bd-8f24-cf1c9096ac70", "classLevel": "1", "organizationId": "8ba8388f-9907-486c-9883-3784c2f2f34e"}, "image": "https://gathjod-emeelan.s3.ap-southeast-2.amazonaws.com/els-media/8ba8388f-9907-486c-9883-3784c2f2f34e/image/2026/05/59670b1e-8e45-4496-82f1-d5b7bd6fc596-Lion.jpg", "gridSize": "3x3", "clickLimit": 20, "difficulty": "medium", "image_asset_id": "51662698-83ae-408d-8c2d-5a3478aba56f"}	2026-05-29 16:17:45.171228
d515f3d9-e84e-4a6d-9d10-0ec4600ff61c	2be08575-5987-4255-9881-20cf6250be1b	fill_blank	Count and fill	Choose the correct number.	\N	30	10	1	{"hint": "Count all mangoes together.", "_meta": {"creatorId": "2bb3d34c-4eae-46bd-8f24-cf1c9096ac70"}, "answer": "5", "options": ["4", "5", "6", "7"], "sentence": "There are 3 mangoes and 2 mangoes. Total is ___"}	2026-05-29 18:32:03.50468
5847de8f-8a2e-45d5-856f-003851e5d0c5	2be08575-5987-4255-9881-20cf6250be1b	guess_image	Find the circle	Tap the circle shape.	\N	25	10	2	{"_meta": {"creatorId": "2bb3d34c-4eae-46bd-8f24-cf1c9096ac70"}, "options": [{"id": "opt_square", "image": "/media/images/square.svg", "label": "Square", "is_correct": false}, {"id": "opt_circle", "image": "/media/images/circle.svg", "label": "Circle", "is_correct": true}, {"id": "opt_triangle", "image": "/media/images/triangle.svg", "label": "Triangle", "is_correct": false}, {"id": "opt_rectangle", "image": "/media/images/rectangle.svg", "label": "Rectangle", "is_correct": false}], "prompt_image": "/media/images/circle.svg"}	2026-05-29 18:32:03.512481
1ae93eb9-aed6-4abe-b24d-10f0f14c9149	2be08575-5987-4255-9881-20cf6250be1b	single_choice	Which is bigger?	Choose the bigger object.	\N	20	10	3	{"_meta": {"creatorId": "2bb3d34c-4eae-46bd-8f24-cf1c9096ac70"}, "options": [{"id": "opt_ant", "image": "/media/images/ant.svg", "label": "Ant", "is_correct": false}, {"id": "opt_elephant", "image": "/media/pictures/elephant.png", "label": "Elephant", "is_correct": true}, {"id": "opt_mouse", "image": "/media/pictures/rat.png", "label": "Mouse", "is_correct": false}]}	2026-05-29 18:32:03.523054
a246c3ab-3aad-472e-a277-7b9a4992da37	b535df36-c742-4235-84fd-7111abe88b3f	fill_blank	Complete the word	Choose the missing letter.	\N	30	10	2	{"hint": "It is a pet animal.", "_meta": {"creatorId": "2bb3d34c-4eae-46bd-8f24-cf1c9096ac70"}, "answer": "A", "options": ["A", "E", "I", "O"], "sentence": "C _ T"}	2026-05-29 18:32:03.588942
bad7e1af-1da5-4981-a028-6647418c9f26	b535df36-c742-4235-84fd-7111abe88b3f	single_choice	What comes after B?	Pick one answer.	\N	20	10	3	{"_meta": {"creatorId": "2bb3d34c-4eae-46bd-8f24-cf1c9096ac70"}, "options": [{"id": "opt_a", "label": "A", "is_correct": false}, {"id": "opt_c", "label": "C", "is_correct": true}, {"id": "opt_d", "label": "D", "is_correct": false}]}	2026-05-29 18:32:03.594753
5b35ffa2-8a6e-4148-8d5e-b7d98cf04977	27544d16-ec5a-4529-85aa-42bd31868291	fill_blank	Pick the opposite	Pick the missing word.	\N	30	10	2	{"hint": "Not big.", "_meta": {"creatorId": "2bb3d34c-4eae-46bd-8f24-cf1c9096ac70"}, "answer": "small", "options": ["small", "tall", "long", "fast"], "sentence": "The opposite of big is ___"}	2026-05-29 18:32:03.624281
3bba7863-664d-4b2c-b150-f25c18d60a68	b535df36-c742-4235-84fd-7111abe88b3f	drag_drop_match	Match letters	Drag letter to correct picture card.	\N	45	15	4	{"_meta": {"creatorId": "2bb3d34c-4eae-46bd-8f24-cf1c9096ac70"}, "drag_items": [{"id": "la", "image": "/media/images/letter-a.svg", "label": "A"}, {"id": "lb", "image": "/media/images/letter-b.svg", "label": "B"}, {"id": "lc", "image": "/media/images/letter-c.svg", "label": "C"}], "match_rules": [{"drag_item_id": "la", "drop_target_id": "ta"}, {"drag_item_id": "lb", "drop_target_id": "tb"}, {"drag_item_id": "lc", "drop_target_id": "tc"}], "drop_targets": [{"id": "ta", "label": "Apple"}, {"id": "tb", "label": "Ball"}, {"id": "tc", "label": "Cat"}]}	2026-05-29 18:32:03.599983
0ba93306-ae02-4cd7-929d-2111903a9650	b535df36-c742-4235-84fd-7111abe88b3f	guess_audio	Which farm animal sound is this?	Listen and choose the right animal.	/media/sounds/cow.mp3	30	10	1	{"_meta": {"creatorId": "2bb3d34c-4eae-46bd-8f24-cf1c9096ac70"}, "options": [{"id": "opt_cow", "label": "Cow", "is_correct": true}, {"id": "opt_horse", "label": "Horse", "is_correct": false}, {"id": "opt_duck", "label": "Duck", "is_correct": false}]}	2026-05-29 18:32:03.580515
3fa7fea6-7fff-422a-ac8a-5d0b76e1519a	5ee076f6-30af-466e-be8c-845ec6c3fe16	memory_match	Match the shape pairs	Flip cards and match the shapes.	\N	45	15	5	{"grid": "2x2", "_meta": {"creatorId": "2bb3d34c-4eae-46bd-8f24-cf1c9096ac70"}, "pairs": [{"id": 1, "label": "Circle", "imageUrl": "/media/images/circle.svg"}, {"id": 2, "label": "Square", "imageUrl": "/media/images/square.svg"}], "clickLimit": 10}	2026-05-29 18:32:03.572328
c58c52fa-2a14-498b-a959-45dff733df3a	5ee076f6-30af-466e-be8c-845ec6c3fe16	single_choice	Which shape has three sides?	Choose one.	\N	20	10	3	{"_meta": {"creatorId": "2bb3d34c-4eae-46bd-8f24-cf1c9096ac70"}, "options": [{"id": "opt_triangle", "image": "/media/images/triangle.svg", "label": "Triangle", "is_correct": true}, {"id": "opt_circle", "image": "/media/images/circle.svg", "label": "Circle", "is_correct": false}, {"id": "opt_square", "image": "/media/images/square.svg", "label": "Square", "is_correct": false}]}	2026-05-29 18:32:03.561486
f162b778-b6bb-49a3-9a10-4fc9c69d73b4	27544d16-ec5a-4529-85aa-42bd31868291	single_choice	Which animal word starts with D?	Choose one.	\N	20	10	3	{"_meta": {"creatorId": "2bb3d34c-4eae-46bd-8f24-cf1c9096ac70"}, "options": [{"id": "opt_dog", "image": "/media/pictures/dog.png", "label": "Dog", "is_correct": true}, {"id": "opt_cat", "image": "/media/pictures/cat.png", "label": "Cat", "is_correct": false}, {"id": "opt_owl", "image": "/media/pictures/owl.png", "label": "Owl", "is_correct": false}]}	2026-05-29 18:32:03.628453
93786fdd-5a06-44b8-b2de-602faa542213	b535df36-c742-4235-84fd-7111abe88b3f	jigsaw	Arrange the alphabet puzzle	Complete the ABC picture.	\N	60	20	5	{"_meta": {"creatorId": "2bb3d34c-4eae-46bd-8f24-cf1c9096ac70"}, "image": "/media/images/abc.svg", "gridSize": "2x2", "clickLimit": 10, "difficulty": "easy"}	2026-05-29 18:32:03.608569
9be4f46a-204c-4a7b-b9f3-fa006f8adb87	5ee076f6-30af-466e-be8c-845ec6c3fe16	drag_drop_match	Match the shapes	Drag each shape to its name.	\N	45	15	4	{"_meta": {"creatorId": "2bb3d34c-4eae-46bd-8f24-cf1c9096ac70"}, "drag_items": [{"id": "d_circle", "image": "/media/images/circle.svg", "label": "Circle"}, {"id": "d_square", "image": "/media/images/square.svg", "label": "Square"}, {"id": "d_triangle", "image": "/media/images/triangle.svg", "label": "Triangle"}], "match_rules": [{"drag_item_id": "d_circle", "drop_target_id": "t_circle"}, {"drag_item_id": "d_square", "drop_target_id": "t_square"}, {"drag_item_id": "d_triangle", "drop_target_id": "t_triangle"}], "drop_targets": [{"id": "t_circle", "label": "Circle"}, {"id": "t_square", "label": "Square"}, {"id": "t_triangle", "label": "Triangle"}]}	2026-05-29 18:32:03.566884
f45cf9b4-5a73-4476-a02b-071da8361941	27544d16-ec5a-4529-85aa-42bd31868291	drag_drop_match	Match word to picture	Drag each animal to its name.	\N	45	15	4	{"_meta": {"creatorId": "2bb3d34c-4eae-46bd-8f24-cf1c9096ac70"}, "drag_items": [{"id": "d_cat", "image": "/media/pictures/cat.png", "label": "Cat"}, {"id": "d_dog", "image": "/media/pictures/dog.png", "label": "Dog"}, {"id": "d_fish", "image": "/media/pictures/fish.png", "label": "Fish"}], "match_rules": [{"drag_item_id": "d_cat", "drop_target_id": "t_cat"}, {"drag_item_id": "d_dog", "drop_target_id": "t_dog"}, {"drag_item_id": "d_fish", "drop_target_id": "t_fish"}], "drop_targets": [{"id": "t_cat", "label": "Cat"}, {"id": "t_dog", "label": "Dog"}, {"id": "t_fish", "label": "Fish"}]}	2026-05-29 18:32:03.631903
b12d4630-b351-465e-9ecb-380bae0c3ade	27544d16-ec5a-4529-85aa-42bd31868291	guess_audio	Which pet sound is this?	Listen and choose the right animal.	/media/sounds/cat.mp3	30	10	1	{"_meta": {"creatorId": "2bb3d34c-4eae-46bd-8f24-cf1c9096ac70"}, "options": [{"id": "opt_cat", "label": "Cat", "is_correct": true}, {"id": "opt_dog", "label": "Dog", "is_correct": false}, {"id": "opt_lion", "label": "Lion", "is_correct": false}]}	2026-05-29 18:32:03.618947
ccdeb9cd-e567-4387-a826-b6226ec6f5d3	87da913a-7c5f-4b8c-9b05-ba8589a8c745	multi_choice	Choose warm colors	Select all warm colors.	\N	35	15	1	{"_meta": {"creatorId": "2bb3d34c-4eae-46bd-8f24-cf1c9096ac70"}, "options": [{"id": "opt_red", "label": "Red", "is_correct": true}, {"id": "opt_blue", "label": "Blue", "is_correct": false}, {"id": "opt_yellow", "label": "Yellow", "is_correct": true}, {"id": "opt_green", "label": "Green", "is_correct": false}]}	2026-05-29 18:32:03.695561
56969021-fa71-42a7-b24d-7ab876deeac8	87da913a-7c5f-4b8c-9b05-ba8589a8c745	fill_blank	Fill the color	Choose the right color word.	\N	25	10	4	{"hint": "Look at a ripe banana.", "_meta": {"creatorId": "2bb3d34c-4eae-46bd-8f24-cf1c9096ac70"}, "answer": "yellow", "options": ["red", "yellow", "blue", "pink"], "sentence": "Banana is ___"}	2026-05-29 18:32:03.705717
a82581a5-d09e-4e3f-8a66-c408c4cad613	87da913a-7c5f-4b8c-9b05-ba8589a8c745	true_false	Sun comes in daytime	Choose True or False.	\N	20	10	5	{"_meta": {"creatorId": "2bb3d34c-4eae-46bd-8f24-cf1c9096ac70"}, "options": [{"id": "opt_true", "label": "True", "is_correct": true}, {"id": "opt_false", "label": "False", "is_correct": false}]}	2026-05-29 18:32:03.708397
8fbb27be-1ccd-4b25-b74f-dab112fe9a15	9675eec6-48bd-4f79-a82f-43b112d81259	multi_choice	Choose the vehicles	Pick all the vehicles.	\N	35	15	1	{"_meta": {"creatorId": "2bb3d34c-4eae-46bd-8f24-cf1c9096ac70"}, "options": [{"id": "opt_bus", "label": "Bus", "is_correct": true}, {"id": "opt_train", "label": "Train", "is_correct": true}, {"id": "opt_dog", "label": "Dog", "is_correct": false}, {"id": "opt_mango", "label": "Mango", "is_correct": false}]}	2026-05-29 18:32:03.714624
6ab133d0-996a-4dd8-966c-8fe3037367a4	87da913a-7c5f-4b8c-9b05-ba8589a8c745	guess_audio	Which animal sound is this?	Listen and choose the right animal.	/media/sounds/dog.mp3	30	10	2	{"_meta": {"creatorId": "2bb3d34c-4eae-46bd-8f24-cf1c9096ac70"}, "options": [{"id": "opt_dog", "label": "Dog", "is_correct": true}, {"id": "opt_cat", "label": "Cat", "is_correct": false}, {"id": "opt_cow", "label": "Cow", "is_correct": false}]}	2026-05-29 18:32:03.698839
63ea59c1-73da-4ccf-896f-be272d3856a4	f1b6e4e0-169e-4f32-a796-bd3abfdb1265	drag_drop_match	Match the helper	Drag each helper to their name.	\N	45	15	3	{"_meta": {"creatorId": "2bb3d34c-4eae-46bd-8f24-cf1c9096ac70"}, "drag_items": [{"id": "d_doctor", "image": "/media/images/doctor.svg", "label": "Doctor"}, {"id": "d_farmer", "image": "/media/images/farmer.svg", "label": "Farmer"}, {"id": "d_postman", "image": "/media/images/postman.svg", "label": "Postman"}], "match_rules": [{"drag_item_id": "d_doctor", "drop_target_id": "t_doctor"}, {"drag_item_id": "d_farmer", "drop_target_id": "t_farmer"}, {"drag_item_id": "d_postman", "drop_target_id": "t_postman"}], "drop_targets": [{"id": "t_doctor", "label": "Doctor"}, {"id": "t_farmer", "label": "Farmer"}, {"id": "t_postman", "label": "Postman"}]}	2026-05-29 18:32:03.681484
4b280b2e-3b2b-4382-8a5d-376f798329c5	f1b6e4e0-169e-4f32-a796-bd3abfdb1265	single_choice	Who grows our food?	Choose one.	\N	25	10	4	{"_meta": {"creatorId": "2bb3d34c-4eae-46bd-8f24-cf1c9096ac70"}, "options": [{"id": "opt_farmer", "image": "/media/images/farmer.svg", "label": "Farmer", "is_correct": true}, {"id": "opt_doctor", "image": "/media/images/doctor.svg", "label": "Doctor", "is_correct": false}, {"id": "opt_postman", "image": "/media/images/postman.svg", "label": "Postman", "is_correct": false}]}	2026-05-29 18:32:03.685501
1af776cb-434a-4513-bdd0-5aa226d895e7	f1b6e4e0-169e-4f32-a796-bd3abfdb1265	guess_image	Find the flower	Tap the flower.	\N	25	10	1	{"_meta": {"creatorId": "2bb3d34c-4eae-46bd-8f24-cf1c9096ac70"}, "options": [{"id": "opt_flower", "image": "/media/images/flower.svg", "label": "Flower", "is_correct": true}, {"id": "opt_star", "image": "/media/images/star.svg", "label": "Star", "is_correct": false}, {"id": "opt_ball", "image": "/media/images/ball.svg", "label": "Ball", "is_correct": false}], "prompt_image": "/media/images/flower.svg"}	2026-05-29 18:32:03.673611
6a58996c-c7fd-4766-bb94-b8bdf2e757d2	87da913a-7c5f-4b8c-9b05-ba8589a8c745	jigsaw	Make the flag puzzle	Arrange the puzzle to see Indian flag.	\N	60	20	3	{"_meta": {"creatorId": "2bb3d34c-4eae-46bd-8f24-cf1c9096ac70"}, "image": "/media/flags/m/IN.svg", "gridSize": "2x2", "clickLimit": 10, "difficulty": "easy"}	2026-05-29 18:32:03.702398
49d97529-f198-4bda-a18c-e5d6590d4240	f1b6e4e0-169e-4f32-a796-bd3abfdb1265	true_false	Plants give us air	Choose True or False.	\N	20	10	2	{"_meta": {"creatorId": "2bb3d34c-4eae-46bd-8f24-cf1c9096ac70"}, "options": [{"id": "opt_true", "label": "True", "is_correct": true}, {"id": "opt_false", "label": "False", "is_correct": false}]}	2026-05-29 18:32:03.678044
c004bcb0-6c6f-414d-9f57-eaac7923fb03	a1b3d3c5-157f-4f6b-9eb8-9a4101f86b64	memory_match	Match same fruits	Flip cards and match fruit pairs.	\N	45	15	5	{"grid": "2x2", "_meta": {"creatorId": "2bb3d34c-4eae-46bd-8f24-cf1c9096ac70"}, "pairs": [{"id": 1, "label": "Apple", "imageUrl": "/media/memory-assets/apple-svgrepo-com.svg"}, {"id": 2, "label": "Banana", "imageUrl": "/media/memory-assets/banana-svgrepo-com.svg"}], "clickLimit": 10}	2026-05-29 18:32:03.666532
c588096e-5630-4721-a763-68212629ee4f	a1b3d3c5-157f-4f6b-9eb8-9a4101f86b64	single_choice	Who helps us when we are sick?	Choose one.	\N	25	10	4	{"_meta": {"creatorId": "2bb3d34c-4eae-46bd-8f24-cf1c9096ac70"}, "options": [{"id": "opt_doctor", "image": "/media/images/doctor.svg", "label": "Doctor", "is_correct": true}, {"id": "opt_postman", "image": "/media/images/postman.svg", "label": "Postman", "is_correct": false}, {"id": "opt_farmer", "image": "/media/images/farmer.svg", "label": "Farmer", "is_correct": false}]}	2026-05-29 18:32:03.661241
5167fbf3-c1b1-41d1-82d9-df80a3fc3765	f1b6e4e0-169e-4f32-a796-bd3abfdb1265	memory_match	Match the garden fruits	Flip cards and match the fruits.	\N	45	15	5	{"grid": "2x2", "_meta": {"creatorId": "2bb3d34c-4eae-46bd-8f24-cf1c9096ac70"}, "pairs": [{"id": 1, "label": "Cherry", "imageUrl": "/media/memory-assets/cherry-svgrepo-com.svg"}, {"id": 2, "label": "Grape", "imageUrl": "/media/memory-assets/grape-svgrepo-com.svg"}], "clickLimit": 10}	2026-05-29 18:32:03.688984
9529527d-dc6f-4934-be57-bf49d87936ef	319442dd-0644-4dad-bb71-cf055cafc3d4	true_false	We should tell the truth	Choose True or False.	\N	20	10	2	{"_meta": {"creatorId": "2bb3d34c-4eae-46bd-8f24-cf1c9096ac70"}, "options": [{"id": "opt_true", "label": "True", "is_correct": true}, {"id": "opt_false", "label": "False", "is_correct": false}]}	2026-05-29 18:32:03.741285
9c338563-43b8-457a-81c5-6da36e3820df	45578aba-3bad-41e4-bbf3-c7a3de764105	single_choice	What should you say to elders?	Choose one.	\N	25	10	1	{"_meta": {"creatorId": "2bb3d34c-4eae-46bd-8f24-cf1c9096ac70"}, "options": [{"id": "opt_namaste", "image": "/media/images/namaste.svg", "label": "Say Namaste", "is_correct": true}, {"id": "opt_shout", "image": "/media/images/loudspeaker.svg", "label": "Shout", "is_correct": false}, {"id": "opt_ignore", "image": "/media/images/no-entry.svg", "label": "Ignore", "is_correct": false}]}	2026-05-29 18:32:03.760632
77a5aa8c-0e42-4e2c-b573-a518c7930a79	8a970f86-cf49-4930-9f82-8130fdf6440f	single_choice	Who helped the lion?	Choose your answer.	\N	25	10	1	{"_meta": {"creatorId": "2bb3d34c-4eae-46bd-8f24-cf1c9096ac70"}, "options": [{"id": "opt_mouse", "label": "The mouse", "is_correct": true}, {"id": "opt_bird", "label": "A bird", "is_correct": false}, {"id": "opt_fish", "label": "A fish", "is_correct": false}]}	2026-05-29 21:09:00.731114
9db67264-7414-43e8-83f6-d5f164c2b27a	8a970f86-cf49-4930-9f82-8130fdf6440f	true_false	The lion was kind and let the mouse go.	Choose your answer.	\N	25	10	2	{"_meta": {"creatorId": "2bb3d34c-4eae-46bd-8f24-cf1c9096ac70"}, "options": [{"id": "opt_true", "label": "True", "is_correct": true}, {"id": "opt_false", "label": "False", "is_correct": false}]}	2026-05-29 21:09:00.736977
e854e322-527c-4f51-91bb-38b019cd17db	45578aba-3bad-41e4-bbf3-c7a3de764105	true_false	We should always tell lies	Choose True or False.	\N	20	10	2	{"_meta": {"creatorId": "2bb3d34c-4eae-46bd-8f24-cf1c9096ac70"}, "options": [{"id": "opt_true", "label": "True", "is_correct": false}, {"id": "opt_false", "label": "False", "is_correct": true}]}	2026-05-29 18:32:03.76707
fd72c39a-91a9-435a-9311-a84660e5df8b	319442dd-0644-4dad-bb71-cf055cafc3d4	drag_drop_match	Good or bad habit	Drag each action to Good Habit or Bad Habit.	\N	45	15	3	{"_meta": {"creatorId": "2bb3d34c-4eae-46bd-8f24-cf1c9096ac70"}, "drag_items": [{"id": "greet", "image": "/media/images/sun.svg", "label": "Say good morning"}, {"id": "litter", "image": "/media/images/wastebasket.svg", "label": "Throw waste on road"}, {"id": "help", "image": "/media/images/older-woman.svg", "label": "Help grandmother"}], "match_rules": [{"drag_item_id": "greet", "drop_target_id": "good"}, {"drag_item_id": "litter", "drop_target_id": "bad"}, {"drag_item_id": "help", "drop_target_id": "good2"}], "drop_targets": [{"id": "good", "label": "Good Habit"}, {"id": "bad", "label": "Bad Habit"}, {"id": "good2", "label": "Good Habit"}]}	2026-05-29 18:32:03.74437
a8842787-1886-4802-a263-92825b5cd440	319442dd-0644-4dad-bb71-cf055cafc3d4	guess_image	Choose respectful action	Tap the respectful picture.	\N	25	10	5	{"_meta": {"creatorId": "2bb3d34c-4eae-46bd-8f24-cf1c9096ac70"}, "options": [{"id": "opt_namaste", "image": "/media/images/namaste.svg", "label": "Say Namaste to elders", "is_correct": true}, {"id": "opt_shout", "image": "/media/images/loudspeaker.svg", "label": "Shout at elders", "is_correct": false}, {"id": "opt_ignore", "image": "/media/images/no-entry.svg", "label": "Ignore elders", "is_correct": false}], "prompt_image": "/media/images/namaste.svg"}	2026-05-29 18:32:03.752904
85d10e0c-781a-4e9b-92d6-dd38c754a563	8a970f86-cf49-4930-9f82-8130fdf6440f	single_choice	What did the mouse chew to free the lion?	Choose your answer.	\N	25	10	3	{"_meta": {"creatorId": "2bb3d34c-4eae-46bd-8f24-cf1c9096ac70"}, "options": [{"id": "opt_net", "label": "The net", "is_correct": true}, {"id": "opt_tree", "label": "A tree", "is_correct": false}, {"id": "opt_grass", "label": "The grass", "is_correct": false}]}	2026-05-29 21:09:00.74217
d6155c79-54e5-47d1-ad2c-8046f8632199	319442dd-0644-4dad-bb71-cf055cafc3d4	memory_match	Match polite words	Flip and match same polite words.	\N	45	15	4	{"grid": "2x2", "_meta": {"creatorId": "2bb3d34c-4eae-46bd-8f24-cf1c9096ac70"}, "pairs": [{"id": 1, "label": "Please", "imageUrl": "/media/memory-assets/cat-svgrepo-com.svg"}, {"id": 2, "label": "Thank You", "imageUrl": "/media/memory-assets/dog-svgrepo-com.svg"}], "clickLimit": 10}	2026-05-29 18:32:03.748462
a39af336-7e44-4455-9e08-bfa9389d90eb	45578aba-3bad-41e4-bbf3-c7a3de764105	memory_match	Match daily good habits	Flip cards and match the habits.	\N	45	15	4	{"grid": "2x2", "_meta": {"creatorId": "2bb3d34c-4eae-46bd-8f24-cf1c9096ac70"}, "pairs": [{"id": 1, "label": "Good Morning", "imageUrl": "/media/images/sun.svg"}, {"id": 2, "label": "School Bag", "imageUrl": "/media/images/backpack.svg"}], "clickLimit": 10}	2026-05-29 18:32:03.775905
40181c80-800a-43d0-b627-c237b7c6b615	27544d16-ec5a-4529-85aa-42bd31868291	jigsaw	Build the cat picture	Drag pieces to rebuild the picture.	\N	60	20	5	{"_meta": {"creatorId": "2bb3d34c-4eae-46bd-8f24-cf1c9096ac70"}, "image": "/media/pictures/cat.png", "gridSize": "2x2", "clickLimit": 10, "difficulty": "easy"}	2026-05-29 18:32:03.637525
0a464ace-9147-4883-a51a-119f2650014c	9675eec6-48bd-4f79-a82f-43b112d81259	true_false	We fly kites on festivals	Choose True or False.	\N	20	10	5	{"_meta": {"creatorId": "2bb3d34c-4eae-46bd-8f24-cf1c9096ac70"}, "options": [{"id": "opt_true", "label": "True", "is_correct": true}, {"id": "opt_false", "label": "False", "is_correct": false}]}	2026-05-29 18:32:03.729984
85cc37a0-aadb-4b82-b5da-c201883d050c	45578aba-3bad-41e4-bbf3-c7a3de764105	guess_image	Which child is helping?	Tap the helpful action.	\N	25	10	5	{"_meta": {"creatorId": "2bb3d34c-4eae-46bd-8f24-cf1c9096ac70"}, "options": [{"id": "opt_help", "image": "/media/images/older-woman.svg", "label": "Helping", "is_correct": true}, {"id": "opt_push", "image": "/media/images/collision.svg", "label": "Pushing", "is_correct": false}, {"id": "opt_litter", "image": "/media/images/wastebasket.svg", "label": "Littering", "is_correct": false}], "prompt_image": "/media/images/older-woman.svg"}	2026-05-29 18:32:03.779735
513d9dcd-729a-4b07-a90c-abb076348b06	42b4467a-0d3d-4e75-90ca-3f7c2cc74b00	single_choice	Where does the duck love to swim?	Choose your answer.	\N	25	10	1	{"_meta": {"creatorId": "2bb3d34c-4eae-46bd-8f24-cf1c9096ac70"}, "options": [{"id": "opt_pond", "label": "In the pond", "is_correct": true}, {"id": "opt_sky", "label": "In the sky", "is_correct": false}, {"id": "opt_sand", "label": "In the sand", "is_correct": false}]}	2026-05-29 21:09:01.237461
5c72911a-7236-4f58-a859-23359e0d4589	42b4467a-0d3d-4e75-90ca-3f7c2cc74b00	single_choice	What sound does a duck make?	Choose your answer.	\N	25	10	2	{"_meta": {"creatorId": "2bb3d34c-4eae-46bd-8f24-cf1c9096ac70"}, "options": [{"id": "opt_quack", "label": "Quack", "is_correct": true}, {"id": "opt_moo", "label": "Moo", "is_correct": false}, {"id": "opt_meow", "label": "Meow", "is_correct": false}]}	2026-05-29 21:09:01.243534
d440601b-4480-4b1c-aa48-81033f035242	42b4467a-0d3d-4e75-90ca-3f7c2cc74b00	true_false	Ducks can swim in water.	Choose your answer.	\N	25	10	3	{"_meta": {"creatorId": "2bb3d34c-4eae-46bd-8f24-cf1c9096ac70"}, "options": [{"id": "opt_true", "label": "True", "is_correct": true}, {"id": "opt_false", "label": "False", "is_correct": false}]}	2026-05-29 21:09:01.248838
8d6ca41f-a793-4d5d-a0bb-6e682ab1bcaa	45578aba-3bad-41e4-bbf3-c7a3de764105	drag_drop_match	Match the kind act	Drag each action to what it shows.	\N	45	15	3	{"_meta": {"creatorId": "2bb3d34c-4eae-46bd-8f24-cf1c9096ac70"}, "drag_items": [{"id": "d_namaste", "image": "/media/images/namaste.svg", "label": "Namaste"}, {"id": "d_share", "image": "/media/images/crayon.svg", "label": "Share"}, {"id": "d_help", "image": "/media/images/older-woman.svg", "label": "Help"}], "match_rules": [{"drag_item_id": "d_namaste", "drop_target_id": "t_respect"}, {"drag_item_id": "d_share", "drop_target_id": "t_share"}, {"drag_item_id": "d_help", "drop_target_id": "t_help"}], "drop_targets": [{"id": "t_respect", "label": "Respect"}, {"id": "t_share", "label": "Sharing"}, {"id": "t_help", "label": "Helping"}]}	2026-05-29 18:32:03.771461
7f76269f-50c1-4f5c-b347-dac80a32bbb4	319442dd-0644-4dad-bb71-cf055cafc3d4	single_choice	What is kind?	Pick the kind action.	\N	25	10	1	{"_meta": {"creatorId": "2bb3d34c-4eae-46bd-8f24-cf1c9096ac70"}, "options": [{"id": "opt_share", "image": "/media/images/crayon.svg", "label": "Share crayons with friend", "is_correct": true}, {"id": "opt_push", "image": "/media/images/collision.svg", "label": "Push friend in line", "is_correct": false}, {"id": "opt_hide", "image": "/media/images/backpack.svg", "label": "Hide friend bag", "is_correct": false}]}	2026-05-29 18:32:03.736531
8939a12e-62a5-47ed-9926-2002d35ca91c	a1b3d3c5-157f-4f6b-9eb8-9a4101f86b64	guess_image	Find the cow	Tap the cow image.	\N	25	10	1	{"_meta": {"creatorId": "2bb3d34c-4eae-46bd-8f24-cf1c9096ac70"}, "options": [{"id": "opt_cow", "image": "/media/pictures/cow.png", "label": "Cow", "is_correct": true}, {"id": "opt_cat", "image": "/media/pictures/cat.png", "label": "Cat", "is_correct": false}, {"id": "opt_horse", "image": "/media/pictures/horse.png", "label": "Horse", "is_correct": false}], "prompt_image": "/media/pictures/cow.png"}	2026-05-29 18:32:03.64601
ca2f5257-e655-4b64-8da9-bba92a8f3267	a1b3d3c5-157f-4f6b-9eb8-9a4101f86b64	drag_drop_match	Match animal and home	Drag each animal to its home.	\N	45	15	3	{"_meta": {"creatorId": "2bb3d34c-4eae-46bd-8f24-cf1c9096ac70"}, "drag_items": [{"id": "a_bird", "image": "/media/pictures/crow.png", "label": "Bird"}, {"id": "a_dog", "image": "/media/pictures/dog.png", "label": "Dog"}, {"id": "a_fish", "image": "/media/pictures/fish.png", "label": "Fish"}], "match_rules": [{"drag_item_id": "a_bird", "drop_target_id": "h_nest"}, {"drag_item_id": "a_dog", "drop_target_id": "h_kennel"}, {"drag_item_id": "a_fish", "drop_target_id": "h_water"}], "drop_targets": [{"id": "h_nest", "label": "Nest"}, {"id": "h_kennel", "label": "Kennel"}, {"id": "h_water", "label": "Water"}]}	2026-05-29 18:32:03.656035
16ecc8bf-49f0-45f7-9756-debed8d96599	2be08575-5987-4255-9881-20cf6250be1b	drag_drop_match	Match number and objects	Drag each object card to the correct number.	\N	45	15	4	{"_meta": {"creatorId": "2bb3d34c-4eae-46bd-8f24-cf1c9096ac70"}, "drag_items": [{"id": "d1", "image": "/media/images/star.svg", "label": "One star"}, {"id": "d2", "image": "/media/images/ball.svg", "label": "Two balls"}, {"id": "d3", "image": "/media/images/flower.svg", "label": "Three flowers"}], "match_rules": [{"drag_item_id": "d1", "drop_target_id": "t1"}, {"drag_item_id": "d2", "drop_target_id": "t2"}, {"drag_item_id": "d3", "drop_target_id": "t3"}], "drop_targets": [{"id": "t1", "label": "1"}, {"id": "t2", "label": "2"}, {"id": "t3", "label": "3"}]}	2026-05-29 18:32:03.530704
35774f1e-aec3-4f7e-b318-46473f82a155	5ee076f6-30af-466e-be8c-845ec6c3fe16	guess_image	Find the square	Tap the square.	\N	25	10	2	{"_meta": {"creatorId": "2bb3d34c-4eae-46bd-8f24-cf1c9096ac70"}, "options": [{"id": "opt_circle", "image": "/media/images/circle.svg", "label": "Circle", "is_correct": false}, {"id": "opt_square", "image": "/media/images/square.svg", "label": "Square", "is_correct": true}, {"id": "opt_triangle", "image": "/media/images/triangle.svg", "label": "Triangle", "is_correct": false}, {"id": "opt_rectangle", "image": "/media/images/rectangle.svg", "label": "Rectangle", "is_correct": false}], "prompt_image": "/media/images/square.svg"}	2026-05-29 18:32:03.554229
89bb83a0-041e-4034-8aea-a37778ee2030	ab8b2ade-1784-4e1a-95d9-aaebc477e42e	single_choice	When does the owl stay awake?	Choose your answer.	\N	25	10	1	{"_meta": {"creatorId": "2bb3d34c-4eae-46bd-8f24-cf1c9096ac70"}, "options": [{"id": "opt_night", "label": "At night", "is_correct": true}, {"id": "opt_noon", "label": "At noon", "is_correct": false}, {"id": "opt_breakfast", "label": "At breakfast", "is_correct": false}]}	2026-05-29 21:09:00.100842
8ede289f-9829-4385-8ed9-543bfaff999c	ab8b2ade-1784-4e1a-95d9-aaebc477e42e	true_false	The owl listens more and speaks less.	Choose your answer.	\N	25	10	2	{"_meta": {"creatorId": "2bb3d34c-4eae-46bd-8f24-cf1c9096ac70"}, "options": [{"id": "opt_true", "label": "True", "is_correct": true}, {"id": "opt_false", "label": "False", "is_correct": false}]}	2026-05-29 21:09:00.119362
316464d4-0e49-4078-a269-ea313c57a68a	ab8b2ade-1784-4e1a-95d9-aaebc477e42e	single_choice	Where does the owl live?	Choose your answer.	\N	25	10	3	{"_meta": {"creatorId": "2bb3d34c-4eae-46bd-8f24-cf1c9096ac70"}, "options": [{"id": "opt_tree", "label": "In a tree", "is_correct": true}, {"id": "opt_sea", "label": "In the sea", "is_correct": false}, {"id": "opt_ground", "label": "Under the ground", "is_correct": false}]}	2026-05-29 21:09:00.124973
ebe14ec3-baaa-4d49-b469-75b51f4b207b	17441c78-2840-40c7-af50-97eaec763fd2	single_choice	What did the crow want?	Choose your answer.	\N	25	10	1	{"_meta": {"creatorId": "2bb3d34c-4eae-46bd-8f24-cf1c9096ac70"}, "options": [{"id": "opt_water", "label": "Water", "is_correct": true}, {"id": "opt_toy", "label": "A toy", "is_correct": false}, {"id": "opt_food", "label": "Food", "is_correct": false}]}	2026-05-29 21:09:00.225811
e464813c-0ef7-420c-bbfe-025a2a73b4cc	17441c78-2840-40c7-af50-97eaec763fd2	single_choice	What did the crow drop in the pot?	Choose your answer.	\N	25	10	2	{"_meta": {"creatorId": "2bb3d34c-4eae-46bd-8f24-cf1c9096ac70"}, "options": [{"id": "opt_stones", "label": "Stones", "is_correct": true}, {"id": "opt_leaves", "label": "Leaves", "is_correct": false}, {"id": "opt_sand", "label": "Sand", "is_correct": false}]}	2026-05-29 21:09:00.230679
0532398b-e524-4043-82a8-187f59d52f89	17441c78-2840-40c7-af50-97eaec763fd2	true_false	The water rose up so the crow could drink.	Choose your answer.	\N	25	10	3	{"_meta": {"creatorId": "2bb3d34c-4eae-46bd-8f24-cf1c9096ac70"}, "options": [{"id": "opt_true", "label": "True", "is_correct": true}, {"id": "opt_false", "label": "False", "is_correct": false}]}	2026-05-29 21:09:00.236277
c4055401-0a67-42b4-9064-a2763e699153	e6eb68ba-7ed2-4cf8-ad0c-ab48b28d7ee7	single_choice	What does the elephant use to take a bath?	Choose your answer.	\N	25	10	1	{"_meta": {"creatorId": "2bb3d34c-4eae-46bd-8f24-cf1c9096ac70"}, "options": [{"id": "opt_trunk", "label": "Its trunk", "is_correct": true}, {"id": "opt_tail", "label": "Its tail", "is_correct": false}, {"id": "opt_ears", "label": "Its ears", "is_correct": false}]}	2026-05-29 21:09:01.812783
32089654-f885-43a3-b9f9-5f147a1fe72a	e6eb68ba-7ed2-4cf8-ad0c-ab48b28d7ee7	true_false	The elephant is a very big animal.	Choose your answer.	\N	25	10	2	{"_meta": {"creatorId": "2bb3d34c-4eae-46bd-8f24-cf1c9096ac70"}, "options": [{"id": "opt_true", "label": "True", "is_correct": true}, {"id": "opt_false", "label": "False", "is_correct": false}]}	2026-05-29 21:09:01.818855
1b39d9e6-3295-4635-9b0e-b329dbc15707	e6eb68ba-7ed2-4cf8-ad0c-ab48b28d7ee7	single_choice	What does the elephant like to eat?	Choose your answer.	\N	25	10	3	{"_meta": {"creatorId": "2bb3d34c-4eae-46bd-8f24-cf1c9096ac70"}, "options": [{"id": "opt_leaves", "label": "Leaves and fruits", "is_correct": true}, {"id": "opt_stones", "label": "Stones", "is_correct": false}, {"id": "opt_shoes", "label": "Shoes", "is_correct": false}]}	2026-05-29 21:09:01.824057
\.


--
-- Data for Name: quizzes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.quizzes (id, organization_id, topic_id, title, description, thumbnail_image, created_by, class_level, subject, quiz_type, difficulty_level, background_music_url, theme, total_questions, is_published, is_ai_generated, created_at, updated_at, is_global, kind) FROM stdin;
cebd3847-5fea-46e4-9f77-0f125b75b352	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	Where Do Animals Live?	Help the animals find their homes in this fun matching game!	\N	\N	LKG	Nature	drag_drop	Easy	/media/bg-audio/eliveta-kids-happy-music-474162.mp3	{"colors": {"primary": "#3b82f6", "background": "#eff6ff"}}	1	t	f	2026-05-21 17:32:02.252038	2026-05-21 17:32:02.252038	f	subject
ab748380-94f3-4909-8572-2e879c2846ba	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	What Animal Sound is That?	Listen to the sound and choose the correct animal!	\N	\N	1	Animals	image_select	Medium	/media/bg-audio/eliveta-kids-happy-music-474162.mp3	{"colors": {"primary": "#10b981", "background": "#ecfdf5"}}	3	t	f	2026-05-21 17:32:02.253466	2026-05-21 17:32:02.253466	f	subject
f3e3aabc-2df0-4496-a324-45cac08f839b	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	Class 1 English: Word Pictures	Look at the pictures and guess the correct English words!	\N	\N	1	English	guess_image	Easy	/media/bg-audio/eliveta-kids-happy-music-474162.mp3	{"colors": {"primary": "#3b82f6", "background": "#eff6ff"}}	3	t	f	2026-05-21 17:32:02.254453	2026-05-21 17:32:02.254453	f	subject
99f27629-ef10-4db4-badc-fcc19496503d	8ba8388f-9907-486c-9883-3784c2f2f34e	b9bddfce-76dc-4128-a8ce-ee29092f0dc6	Nouns & Naming Words Quiz	Look at the pictures and identify the naming words.	\N	\N	1	English	guess_image	Easy	/media/bg-audio/eliveta-kids-happy-music-474162.mp3	{"colors": {"primary": "#3b82f6", "background": "#eff6ff"}}	2	t	f	2026-05-21 17:32:02.263415	2026-05-21 17:32:02.263415	f	subject
922c6dcc-7ded-4249-9e8f-52b7f56d515e	8ba8388f-9907-486c-9883-3784c2f2f34e	c78ac65b-1a7e-47ed-8f8c-edf26ee40108	Alphabet Sounds Quiz	Listen to phonetic sounds and choose the correct English letter.	\N	\N	1	English	guess_audio	Easy	/media/bg-audio/eliveta-kids-happy-music-474162.mp3	{"colors": {"primary": "#10b981", "background": "#ecfdf5"}}	2	t	f	2026-05-21 17:32:02.262646	2026-05-22 15:41:02.699455	f	story
fa7a6f0c-1a53-4f15-bb9d-cc162985a33c	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	Jigsaw puzzle quiz	Jigsaw puzzle quiz	\N	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	1	English	jigsaw	Easy	\N	{"colors": {"primary": "#1d4ed8", "background": "#eff6ff"}, "settings": {"pointPolicy": "ignore_question_points", "hasTimeLimit": false, "assessmentType": "quiz", "timeLimitMinutes": null}}	1	t	f	2026-05-29 16:17:45.158565	2026-05-29 16:17:45.171228	f	subject
42848837-bd7f-4e3b-b558-2b2805b16192	8ba8388f-9907-486c-9883-3784c2f2f34e	3f958c31-4f27-4e40-8d55-99233727e105	Simple Action Words Quiz	Look at the animals and identify their actions.	\N	\N	1	English	guess_image	Easy	/media/bg-audio/eliveta-kids-happy-music-474162.mp3	{"colors": {"primary": "#3b82f6", "background": "#eff6ff"}}	1	t	f	2026-05-21 17:32:02.264172	2026-05-21 17:32:02.264172	f	story
079c6e5c-47b5-4af1-b9a8-f8ffdc1a8b92	8ba8388f-9907-486c-9883-3784c2f2f34e	c78ac65b-1a7e-47ed-8f8c-edf26ee40108	Class 1 English: Listen & Learn	Listen to the audio clips and choose the correct English words!	\N	\N	1	English	guess_audio	Easy	/media/bg-audio/eliveta-kids-happy-music-474162.mp3	{"colors": {"primary": "#10b981", "background": "#ecfdf5"}}	3	t	f	2026-05-21 17:32:02.255461	2026-05-22 15:41:02.699455	f	subject
b2afc6d9-df09-4405-8c36-cdff8f3b3b89	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	Hindi Story Quiz	New	\N	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	3	Hindi Stories	single_choice	Medium	\N	{"colors": {"primary": "#1d4ed8", "background": "#eff6ff"}, "settings": {"pointPolicy": "ignore_question_points", "hasTimeLimit": true, "assessmentType": "quiz", "timeLimitMinutes": 2}}	1	t	f	2026-05-22 16:06:06.064187	2026-05-22 16:06:06.076247	f	subject
9a4c3dfd-1f6a-4379-8bd3-790a95781aab	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	Logico QUiz	Logico QUiz	\N	866bc022-307f-4218-94a3-7622dd2aec79	3	Hindi Stories	single_choice	Easy	\N	{"colors": {"primary": "#1d4ed8", "background": "#eff6ff"}, "settings": {"pointPolicy": "ignore_question_points", "hasTimeLimit": false, "assessmentType": "quiz", "timeLimitMinutes": null}}	1	t	f	2026-05-23 14:21:20.359287	2026-05-23 14:21:20.37021	f	subject
9e6f205f-b471-4400-9691-befa9cc13c9d	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	Body Parts	This Body Parts	\N	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	3	Hindi Stories	single_choice	Easy	\N	{"colors": {"primary": "#1d4ed8", "background": "#eff6ff"}, "settings": {"pointPolicy": "ignore_question_points", "hasTimeLimit": false, "assessmentType": "quiz", "timeLimitMinutes": null}}	1	t	f	2026-05-24 17:32:35.866484	2026-05-24 17:32:35.878458	f	subject
f85700b3-faa3-4042-b8c4-c78a31a39610	8ba8388f-9907-486c-9883-3784c2f2f34e	95ff0bf2-2dec-4b6f-bb92-e14b52f9217b	Class 1 English: Comprehensive Master Quiz	Challenge yourself with different question types about letters, naming words, and actions!	\N	\N	1	English	single_choice	Medium	/media/bg-audio/eliveta-kids-happy-music-474162.mp3	{"colors": {"primary": "#3b82f6", "background": "#eff6ff"}}	6	t	f	2026-05-21 17:32:02.264651	2026-05-21 17:32:02.264651	f	story
52edaca0-d62c-47cd-a587-6aeccd7eda7f	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	Memory Game QUiz	Memory Game QUiz	\N	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	1	English	single_choice	Easy	\N	{"colors": {"primary": "#1d4ed8", "background": "#eff6ff"}, "settings": {"pointPolicy": "ignore_question_points", "hasTimeLimit": false, "assessmentType": "quiz", "timeLimitMinutes": null}}	1	t	f	2026-05-28 23:32:50.294796	2026-05-28 23:32:50.311832	f	subject
d9ba92a0-cd24-493c-a7a4-be57a6755e61	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	Fill in the blanks 1	Fill in the blanks 1	\N	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	1	English	fill_blank	Easy	\N	{"colors": {"primary": "#1d4ed8", "background": "#eff6ff"}, "settings": {"pointPolicy": "ignore_question_points", "hasTimeLimit": false, "assessmentType": "quiz", "timeLimitMinutes": null}}	1	t	f	2026-05-29 02:15:36.899811	2026-05-29 02:15:36.912487	f	subject
8d923268-03f8-40e6-b819-e45fda5c5c18	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	Jigzaw Quiz	Jigzaw Quiz	\N	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	LKG	Activity / Play-based Learning	single_choice	Easy	\N	{"colors": {"primary": "#1d4ed8", "background": "#eff6ff"}, "settings": {"pointPolicy": "ignore_question_points", "hasTimeLimit": false, "assessmentType": "quiz", "timeLimitMinutes": null}}	1	t	f	2026-05-29 16:02:11.260501	2026-05-29 16:02:11.271138	f	subject
2be08575-5987-4255-9881-20cf6250be1b	8ba8388f-9907-486c-9883-3784c2f2f34e	abab4c93-6170-4b8b-b870-53b2204b6d21	LKG Mathematics - Numbers and Counting	LKG Mathematics quiz with playful learning activities in Indian classroom context.	\N	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	LKG	Mathematics	single_choice	easy	\N	{"name": "Rainbow Garden Adventure", "iconUrl": "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f522.svg", "cardColor": "#EBF4FF", "accentColor": "#FF7043", "primaryColor": "#4A90E2", "learningContent": {"topic": "Numbers and Counting", "subject": "Mathematics", "summary": "Simple Mathematics concepts for LKG: Numbers and Counting with visuals, actions, and repetition.", "youtubeLinks": ["https://www.youtube.com/watch?v=DR-cfDsHCGA", "https://www.youtube.com/watch?v=HrxZWNu72WI"], "classroomActivity": "Show picture cards, ask children to answer by tapping, matching, and speaking."}}	5	t	t	2026-05-29 18:32:03.495799	2026-05-29 21:02:27.873739	f	subject
5ee076f6-30af-466e-be8c-845ec6c3fe16	8ba8388f-9907-486c-9883-3784c2f2f34e	6c95753e-72f8-4991-9140-9a191dfd3b09	LKG Mathematics - Shapes and Comparison	LKG Mathematics quiz with playful learning activities in Indian classroom context.	\N	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	LKG	Mathematics	single_choice	easy	\N	{"name": "Rainbow Garden Adventure", "iconUrl": "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f522.svg", "cardColor": "#EBF4FF", "accentColor": "#FF7043", "primaryColor": "#4A90E2", "learningContent": {"topic": "Shapes and Comparison", "subject": "Mathematics", "summary": "Simple Mathematics concepts for LKG: Shapes and Comparison with visuals, actions, and repetition.", "youtubeLinks": ["https://www.youtube.com/watch?v=HrxZWNu72WI", "https://www.youtube.com/watch?v=DR-cfDsHCGA"], "classroomActivity": "Show picture cards, ask children to answer by tapping, matching, and speaking."}}	5	t	t	2026-05-29 18:32:03.544493	2026-05-29 21:02:27.879137	f	subject
b535df36-c742-4235-84fd-7111abe88b3f	8ba8388f-9907-486c-9883-3784c2f2f34e	8ad4c947-6907-4faf-8979-2b5d383be925	LKG English - Alphabet and Phonics	LKG English quiz with playful learning activities in Indian classroom context.	\N	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	LKG	English	single_choice	easy	\N	{"name": "Rainbow Garden Adventure", "iconUrl": "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f4d6.svg", "cardColor": "#EBF4FF", "accentColor": "#FF7043", "primaryColor": "#4A90E2", "learningContent": {"topic": "Alphabet and Phonics", "subject": "English", "summary": "Simple English concepts for LKG: Alphabet and Phonics with visuals, actions, and repetition.", "youtubeLinks": ["https://www.youtube.com/watch?v=75p-N9YKqNo", "https://www.youtube.com/watch?v=BELlZKpi1Zs"], "classroomActivity": "Show picture cards, ask children to answer by tapping, matching, and speaking."}}	5	t	t	2026-05-29 18:32:03.576978	2026-05-29 21:02:27.882724	f	subject
27544d16-ec5a-4529-85aa-42bd31868291	8ba8388f-9907-486c-9883-3784c2f2f34e	22bee16a-51d9-4b57-927d-9362be9069ca	LKG English - Simple Words	LKG English quiz with playful learning activities in Indian classroom context.	\N	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	LKG	English	single_choice	easy	\N	{"name": "Rainbow Garden Adventure", "iconUrl": "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f4d6.svg", "cardColor": "#EBF4FF", "accentColor": "#FF7043", "primaryColor": "#4A90E2", "learningContent": {"topic": "Simple Words", "subject": "English", "summary": "Simple English concepts for LKG: Simple Words with visuals, actions, and repetition.", "youtubeLinks": ["https://www.youtube.com/watch?v=BELlZKpi1Zs", "https://www.youtube.com/watch?v=75p-N9YKqNo"], "classroomActivity": "Show picture cards, ask children to answer by tapping, matching, and speaking."}}	5	t	t	2026-05-29 18:32:03.614272	2026-05-29 21:02:27.886767	f	subject
a1b3d3c5-157f-4f6b-9eb8-9a4101f86b64	8ba8388f-9907-486c-9883-3784c2f2f34e	537a4350-ec04-4f2d-8008-57c438b15c78	LKG EVS - Animals and Homes	LKG EVS quiz with playful learning activities in Indian classroom context.	\N	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	LKG	EVS	single_choice	easy	\N	{"name": "Rainbow Garden Adventure", "iconUrl": "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f331.svg", "cardColor": "#EBF4FF", "accentColor": "#FF7043", "primaryColor": "#4A90E2", "learningContent": {"topic": "Animals and Homes", "subject": "EVS", "summary": "Simple EVS concepts for LKG: Animals and Homes with visuals, actions, and repetition.", "youtubeLinks": ["https://www.youtube.com/results?search_query=lkg+evs+animals+and+their+homes", "https://www.youtube.com/results?search_query=lkg+pet+animals+for+kids"], "classroomActivity": "Show picture cards, ask children to answer by tapping, matching, and speaking."}}	5	t	t	2026-05-29 18:32:03.641771	2026-05-29 21:02:27.89068	f	subject
f1b6e4e0-169e-4f32-a796-bd3abfdb1265	8ba8388f-9907-486c-9883-3784c2f2f34e	05e302de-34ec-4fc3-974f-7870f17100a2	LKG EVS - Plants and Helpers	LKG EVS quiz with playful learning activities in Indian classroom context.	\N	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	LKG	EVS	single_choice	easy	\N	{"name": "Rainbow Garden Adventure", "iconUrl": "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f331.svg", "cardColor": "#EBF4FF", "accentColor": "#FF7043", "primaryColor": "#4A90E2", "learningContent": {"topic": "Plants and Helpers", "subject": "EVS", "summary": "Simple EVS concepts for LKG: Plants and Helpers with visuals, actions, and repetition.", "youtubeLinks": ["https://www.youtube.com/results?search_query=lkg+plants+for+kids+english", "https://www.youtube.com/results?search_query=lkg+community+helpers+for+kids"], "classroomActivity": "Show picture cards, ask children to answer by tapping, matching, and speaking."}}	5	t	t	2026-05-29 18:32:03.670577	2026-05-29 21:02:27.894326	f	subject
87da913a-7c5f-4b8c-9b05-ba8589a8c745	8ba8388f-9907-486c-9883-3784c2f2f34e	967b05c6-1a77-4af2-9d59-a9173ccd9841	LKG General Knowledge - Colours and Objects	LKG General Knowledge quiz with playful learning activities in Indian classroom context.	\N	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	LKG	General Knowledge	single_choice	easy	\N	{"name": "Rainbow Garden Adventure", "iconUrl": "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f30d.svg", "cardColor": "#EBF4FF", "accentColor": "#FF7043", "primaryColor": "#4A90E2", "learningContent": {"topic": "Colours and Objects", "subject": "General Knowledge", "summary": "Simple General Knowledge concepts for LKG: Colours and Objects with visuals, actions, and repetition.", "youtubeLinks": ["https://www.youtube.com/watch?v=zxIpA5nF_LY", "https://www.youtube.com/results?search_query=lkg+colours+for+kids+english"], "classroomActivity": "Show picture cards, ask children to answer by tapping, matching, and speaking."}}	5	t	t	2026-05-29 18:32:03.692294	2026-05-29 21:02:27.897859	f	subject
9675eec6-48bd-4f79-a82f-43b112d81259	8ba8388f-9907-486c-9883-3784c2f2f34e	b0d5556f-c326-4509-a78e-cf5b7f646119	LKG General Knowledge - Transport and Festivals	LKG General Knowledge quiz with playful learning activities in Indian classroom context.	\N	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	LKG	General Knowledge	single_choice	easy	\N	{"name": "Rainbow Garden Adventure", "iconUrl": "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f30d.svg", "cardColor": "#EBF4FF", "accentColor": "#FF7043", "primaryColor": "#4A90E2", "learningContent": {"topic": "Transport and Festivals", "subject": "General Knowledge", "summary": "Simple General Knowledge concepts for LKG: Transport and Festivals with visuals, actions, and repetition.", "youtubeLinks": ["https://www.youtube.com/watch?v=zxIpA5nF_LY", "https://www.youtube.com/results?search_query=lkg+transport+name+for+kids"], "classroomActivity": "Show picture cards, ask children to answer by tapping, matching, and speaking."}}	5	t	t	2026-05-29 18:32:03.711231	2026-05-29 21:02:27.901993	f	subject
319442dd-0644-4dad-bb71-cf055cafc3d4	8ba8388f-9907-486c-9883-3784c2f2f34e	271dd99c-8da0-4b42-ba47-9ff8edcffab3	LKG Moral Values - Sharing and Caring	LKG Moral Values quiz with playful learning activities in Indian classroom context.	\N	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	LKG	Moral Values	single_choice	easy	\N	{"name": "Rainbow Garden Adventure", "iconUrl": "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f91d.svg", "cardColor": "#EBF4FF", "accentColor": "#FF7043", "primaryColor": "#4A90E2", "learningContent": {"topic": "Sharing and Caring", "subject": "Moral Values", "summary": "Simple Moral Values concepts for LKG: Sharing and Caring with visuals, actions, and repetition.", "youtubeLinks": ["https://www.youtube.com/results?search_query=sharing+is+caring+story+for+kids+english", "https://www.youtube.com/results?search_query=kindness+story+for+kids+english"], "classroomActivity": "Show picture cards, ask children to answer by tapping, matching, and speaking."}}	5	t	t	2026-05-29 18:32:03.733667	2026-05-29 21:02:27.905832	f	subject
45578aba-3bad-41e4-bbf3-c7a3de764105	8ba8388f-9907-486c-9883-3784c2f2f34e	cad6a327-c1b2-4dce-a6d8-196fd25ede80	LKG Moral Values - Honesty and Respect	LKG Moral Values quiz with playful learning activities in Indian classroom context.	\N	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	LKG	Moral Values	single_choice	easy	\N	{"name": "Rainbow Garden Adventure", "iconUrl": "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f91d.svg", "cardColor": "#EBF4FF", "accentColor": "#FF7043", "primaryColor": "#4A90E2", "learningContent": {"topic": "Honesty and Respect", "subject": "Moral Values", "summary": "Simple Moral Values concepts for LKG: Honesty and Respect with visuals, actions, and repetition.", "youtubeLinks": ["https://www.youtube.com/results?search_query=honesty+story+for+kids+short+animated", "https://www.youtube.com/results?search_query=respect+for+elders+for+kids"], "classroomActivity": "Show picture cards, ask children to answer by tapping, matching, and speaking."}}	5	t	t	2026-05-29 18:32:03.757444	2026-05-29 21:02:27.909376	f	subject
e6eb68ba-7ed2-4cf8-ad0c-ab48b28d7ee7	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	The Gentle Elephant - Quick Quiz	Story comprehension quiz for little learners.	\N	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	LKG	Stories	single_choice	easy	\N	{}	3	t	t	2026-05-29 21:09:01.807967	2026-05-29 21:09:01.824627	f	story
17441c78-2840-40c7-af50-97eaec763fd2	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	The Thirsty Crow - Quick Quiz	Story comprehension quiz for little learners.	\N	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	LKG	Stories	single_choice	easy	\N	{}	3	t	t	2026-05-29 21:09:00.220415	2026-05-29 21:09:00.236699	f	story
ab8b2ade-1784-4e1a-95d9-aaebc477e42e	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	The Wise Old Owl - Quick Quiz	Story comprehension quiz for little learners.	\N	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	LKG	Stories	single_choice	easy	\N	{}	3	t	t	2026-05-29 21:09:00.087191	2026-05-29 21:09:00.125681	f	story
8a970f86-cf49-4930-9f82-8130fdf6440f	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	The Lion and the Mouse - Quick Quiz	Story comprehension quiz for little learners.	\N	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	LKG	Stories	single_choice	easy	\N	{}	3	t	t	2026-05-29 21:09:00.725308	2026-05-29 21:09:00.743029	f	story
42b4467a-0d3d-4e75-90ca-3f7c2cc74b00	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	The Happy Duck - Quick Quiz	Story comprehension quiz for little learners.	\N	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	LKG	Stories	single_choice	easy	\N	{}	3	t	t	2026-05-29 21:09:01.231623	2026-05-29 21:09:01.249405	f	story
\.


--
-- Data for Name: refresh_tokens; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.refresh_tokens (id, user_id, token_hash, device_info, ip_address, expires_at, revoked, created_at) FROM stdin;
2df65a9d-3bc8-41e1-b279-3de0a88b2831	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3NzkzNjUwMDcsImV4cCI6MTc4MTk1NzAwN30.vviBoxjDx-bFRd4HgEEX5t_nfmCHLxnZkc9W9KypX34	\N	\N	2026-06-20 17:33:27.628	f	2026-05-21 17:33:27.628284
878f8166-56d3-453a-a827-76ee2cfe173a	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3NzkzNjUwMDksImV4cCI6MTc4MTk1NzAwOX0.ZOGu6rCtxYPLO4oYlkym7dMjFueR6QOtuEmqFqKRZmo	\N	\N	2026-06-20 17:33:29.761	f	2026-05-21 17:33:29.761193
1918c2d2-5365-421c-8166-9d4ca02ff0e3	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3NzkzNjU3OTgsImV4cCI6MTc4MTk1Nzc5OH0.GZ_uG1ga606uOe02XRuSIX-e8JuR5OF3KJ5tWzQHlAc	\N	\N	2026-06-20 17:46:38.815	f	2026-05-21 17:46:38.815636
09bcb513-c621-4735-8c31-d4b13dc50802	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3NzkzNjUwMTIsImV4cCI6MTc4MTk1NzAxMn0.K4CXLwy7j5FPUkZKEpOQi0HlvcGFoP3Xxp6zAzn2-g4	\N	\N	2026-06-20 17:33:32.259	t	2026-05-21 17:33:32.25927
20f45396-bd77-4249-ac96-3c244955f20b	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3NzkzNjU5MTksImV4cCI6MTc4MTk1NzkxOX0._832wGJJKjxIAVXbUquAoG11ja0jephk9JDtg9XSmSE	\N	\N	2026-06-20 17:48:39.913	f	2026-05-21 17:48:39.914094
2376e13a-cdc0-4577-b29c-0e5209ea4627	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3NzkzNjU5ODMsImV4cCI6MTc4MTk1Nzk4M30.bW7ZXnhF0H4SmQ0URzBfNgRbaYLEtI5BoY7-DHlwnPA	\N	\N	2026-06-20 17:49:43.267	t	2026-05-21 17:49:43.267262
f20e8fe2-b8e7-4728-a2f3-da6f4f8b6567	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3NzkzNjcyOTIsImV4cCI6MTc4MTk1OTI5Mn0.kfoH41NYeVA_olKG2Bb5ZFYNJA8flISjankYWQlO-1o	\N	\N	2026-06-20 18:11:32.621	t	2026-05-21 18:11:32.621243
66c2e35c-e7c0-44ce-a75a-8b572209f577	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3NzkzNjkwNDksImV4cCI6MTc4MTk2MTA0OX0.P3oTSkSb39Gr1bepuMepTn624kN8hPs6en_jlOzE7Rg	\N	\N	2026-06-20 18:40:49.308	t	2026-05-21 18:40:49.30915
23d53bb8-e379-4e91-a02f-9ed51ab8e1a8	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3NzkzNzAzMTMsImV4cCI6MTc4MTk2MjMxM30.HPuakGJRQj-BYdmoAHQhW8S9H1_8ajSZ-s7WYbznUj4	\N	\N	2026-06-20 19:01:53.274	t	2026-05-21 19:01:53.274429
a59e90db-a7a3-4376-8582-020f85ccce1a	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3NzkzNzE0NDAsImV4cCI6MTc4MTk2MzQ0MH0.SR0y4VpUdfsYyrlCphXtFohDmY9_6DIjh1Y235U4Bi4	\N	\N	2026-06-20 19:20:40.518	t	2026-05-21 19:20:40.518441
728d9afd-0213-4709-9ea2-8a79e1c50939	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3NzkzNzI3NjEsImV4cCI6MTc4MTk2NDc2MX0.DNZlClPh8gW8f7hTYjHCFV2y1nHCDaYUFQjkmHJztGo	\N	\N	2026-06-20 19:42:41.598	t	2026-05-21 19:42:41.598122
45a25a4a-a61f-451c-a026-29e2f172bb6b	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3NzkzNzM3MzEsImV4cCI6MTc4MTk2NTczMX0.DB8tzUXoQbjjSYi2kZbasc6ppPJSmSO2wFvOLNXfsiQ	\N	\N	2026-06-20 19:58:51.021	t	2026-05-21 19:58:51.022081
3beb0291-ebd8-4c7c-9aa5-18b98a54816a	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3NzkzNzQ3NzYsImV4cCI6MTc4MTk2Njc3Nn0.uxoe2AN4CpvhxOE4I6qJsqLP_lYfG62P2BifYIvlphQ	\N	\N	2026-06-20 20:16:16.774	t	2026-05-21 20:16:16.774726
c6ee9f1c-7d3d-4050-8215-5c7412b77229	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3NzkzNzU3MjAsImV4cCI6MTc4MTk2NzcyMH0.wPdI8Y-wUG1NGsVmAg4aqYD15Z61J9n2OmEA2OahDnA	\N	\N	2026-06-20 20:32:00.183	t	2026-05-21 20:32:00.183454
b80b743c-97be-4986-bd91-042530606f4d	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3NzkzNzY2OTMsImV4cCI6MTc4MTk2ODY5M30.hFlx8SqlS7K0hNRedrhLPoR_ES0efi3sRDnrjPRSIk4	\N	\N	2026-06-20 20:48:13.716	f	2026-05-21 20:48:13.716859
38538504-8261-448a-be7d-98e6defc5a21	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3NzkzNzcxMzYsImV4cCI6MTc4MTk2OTEzNn0.tVnEUJVLLQgmG_dwpF-znvoYkSlGst9ug1zhlVYtcSg	\N	\N	2026-06-20 20:55:36.536	f	2026-05-21 20:55:36.536498
c890570b-fb38-4d7a-9623-a196904ffc92	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3NzkzNzcxNDIsImV4cCI6MTc4MTk2OTE0Mn0.i4HVvrEDRgIWzHjzg-PGfeVrPG-JI7uyLlPTwBImllc	\N	\N	2026-06-20 20:55:42.424	t	2026-05-21 20:55:42.4247
b583ff7d-a03d-41c6-8be3-f47255bed1c0	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3NzkzNzgzODUsImV4cCI6MTc4MTk3MDM4NX0.CucL_x2Fug1BEiyI3F9FvBuCRcuOMGox7RfzbJFZ4IE	\N	\N	2026-06-20 21:16:25.674	f	2026-05-21 21:16:25.674493
43af5f46-07a7-45e8-9c94-b39df06e7795	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3NzkzNzg2OTQsImV4cCI6MTc4MTk3MDY5NH0.O9fK7hzBR7OPANtm_gJH60gBFGc3qItbrnm-i1Zw_6Q	\N	\N	2026-06-20 21:21:34.322	f	2026-05-21 21:21:34.322946
9a89fd62-3809-4f7e-9255-313aaabad169	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3NzkzNzk1MDMsImV4cCI6MTc4MTk3MTUwM30.oHWBTY2lg_lkVPtgPbpLFvTZ33QMTbkFuFWgXz5o678	\N	\N	2026-06-20 21:35:03.172	t	2026-05-21 21:35:03.172787
b7aa204b-7a26-40a3-bc1c-f4cbd6788aaf	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3NzkzODA2MjQsImV4cCI6MTc4MTk3MjYyNH0.zOgufsVtJ-5itn7AuVDNsqEcdxTKsMv0iWN-rIFUgpI	\N	\N	2026-06-20 21:53:44.095	t	2026-05-21 21:53:44.096158
9603b385-f876-4b75-80e8-3ba19fc93ee6	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3NzkzODE4NDQsImV4cCI6MTc4MTk3Mzg0NH0.e2gAQJZy6hSA3wKy88s_DytXlydZyt2DbtdMAOoR7qQ	\N	\N	2026-06-20 22:14:04.824	f	2026-05-21 22:14:04.824263
05290a9b-4657-4f52-96eb-8a3d41094985	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3NzkzODE5OTYsImV4cCI6MTc4MTk3Mzk5Nn0.QPTbVl0AikfB20zafLKMlSGsPEhGSMk45By3GBA2gfE	\N	\N	2026-06-20 22:16:36.825	t	2026-05-21 22:16:36.826003
89cc1a09-b544-4fc5-8186-77c47ab89204	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3NzkzODM1MjcsImV4cCI6MTc4MTk3NTUyN30.iqkook1tz4q0KEtdsuMPyt_99-xjbsJ-eBnKepU2_UM	\N	\N	2026-06-20 22:42:07.424	t	2026-05-21 22:42:07.424793
a76282cd-2a34-4b4e-a7f7-4ee9a7237c79	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3NzkzODM1MjcsImV4cCI6MTc4MTk3NTUyN30.iqkook1tz4q0KEtdsuMPyt_99-xjbsJ-eBnKepU2_UM	\N	\N	2026-06-20 22:42:07.426	f	2026-05-21 22:42:07.426261
a19a8cd1-ca7f-44a5-b796-f0769aa5534a	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3NzkzODM1MjcsImV4cCI6MTc4MTk3NTUyN30.iqkook1tz4q0KEtdsuMPyt_99-xjbsJ-eBnKepU2_UM	\N	\N	2026-06-20 22:42:07.425	f	2026-05-21 22:42:07.425309
03944fbf-0d71-46d9-ad6d-ce041e069563	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3NzkzODQ0NjksImV4cCI6MTc4MTk3NjQ2OX0.-QTMNqmGmrGrekHXJ0UiQR7HNcm1no3LEuaM7XcOoyE	\N	\N	2026-06-20 22:57:49.129	f	2026-05-21 22:57:49.129959
832ee990-a40d-4ed8-8890-7deb522a72ae	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3NzkzODQ0NjksImV4cCI6MTc4MTk3NjQ2OX0.-QTMNqmGmrGrekHXJ0UiQR7HNcm1no3LEuaM7XcOoyE	\N	\N	2026-06-20 22:57:49.131	f	2026-05-21 22:57:49.131315
cdd436a7-2e10-468f-8367-482952bb3da6	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3NzkzODUxNTksImV4cCI6MTc4MTk3NzE1OX0.eWZYR1nLHlln_1ohLBneXEI0u0VcrwTPxVbKdpY5TAQ	\N	\N	2026-06-20 23:09:19.302	f	2026-05-21 23:09:19.30243
466227be-361e-40f5-9b8f-9aab7196d814	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3NzkzODUxNjEsImV4cCI6MTc4MTk3NzE2MX0.uqcJ2ZJeeRbbUivHqDSiP_UaYBEiv3tNUVBwCSJNd-o	\N	\N	2026-06-20 23:09:21.084	f	2026-05-21 23:09:21.084718
19bd9d09-040a-4d92-b6c7-febe44bc9cea	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3NzkzODUxNjUsImV4cCI6MTc4MTk3NzE2NX0.02PJoEgb9mIIIGvfZVXcoqxrOLDWHNgpgS3CO_t2H-Q	\N	\N	2026-06-20 23:09:25.908	f	2026-05-21 23:09:25.908824
6e6a92b2-a968-4fe5-aeb4-3114f3a94048	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3NzkzODUxNzMsImV4cCI6MTc4MTk3NzE3M30.CXZJmdzGNGzILclNW4AtT_ReuSVhfR77Izjs1k3NHGY	\N	\N	2026-06-20 23:09:33.3	f	2026-05-21 23:09:33.301162
2c390036-3ee8-439e-9339-eecefff5c0d6	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3NzkzODUxNzUsImV4cCI6MTc4MTk3NzE3NX0.Bf5wFZivMCCMxcJQAQeIGhhG3V6hx-n4HqzoOHRA9nk	\N	\N	2026-06-20 23:09:35.259	f	2026-05-21 23:09:35.259956
685ef225-75dc-490f-8e13-e2a38f58594f	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3NzkzODgxOTEsImV4cCI6MTc4MTk4MDE5MX0.QEIu2Td4y2FVmwKWF6_f7e69uH86dX9Qh-v0owFnrRM	\N	\N	2026-06-20 23:59:51.19	f	2026-05-21 23:59:51.191065
38ee5fe6-5a98-4e81-8e0e-0850a6edb652	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk0MzY1MDEsImV4cCI6MTc4MjAyODUwMX0.MZM0I78P70CW6lzLXgyyYuPXdCHfPw7IYhsrj2Tfq6Q	\N	\N	2026-06-21 13:25:01.966	f	2026-05-22 13:25:01.967035
bac092a0-4c81-4550-922d-50d362325c83	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3NzkzODkyNzYsImV4cCI6MTc4MTk4MTI3Nn0.AnrKerLn_8u7pTvsm3I7o0pmpWQAeGwNoW_aymzjY00	\N	\N	2026-06-21 00:17:56.93	t	2026-05-22 00:17:56.930527
3fb528bf-f4d3-413e-8bfb-02a746326f70	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3NzkzOTA0OTUsImV4cCI6MTc4MTk4MjQ5NX0.uRYRrwOMDn23isLFWOkdm1T35VTa0DaYCqEx7nBvVH8	\N	\N	2026-06-21 00:38:15.845	f	2026-05-22 00:38:15.846046
99f9917a-4b0b-4370-bb69-5f5ed5ee3469	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3NzkzOTA3MzMsImV4cCI6MTc4MTk4MjczM30.mlKY_aQOCp-q_aMyYjCoaUGqsV9ogRRlODIxpehloI4	\N	\N	2026-06-21 00:42:13.366	f	2026-05-22 00:42:13.366684
abcb5ae0-5492-42a5-9e5c-a44336cb5303	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3NzkzOTEwNjYsImV4cCI6MTc4MTk4MzA2Nn0.Y37qP1Nd0-Jmx7_BZ0qtQ1eQHNMGYHNnLKl-XNzoOnE	\N	\N	2026-06-21 00:47:46.972	f	2026-05-22 00:47:46.972919
7fee033b-a818-4cfd-b7a9-6e3b8c844355	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3NzkzOTExMjYsImV4cCI6MTc4MTk4MzEyNn0.u7LZsb-Td6DI-GP87zovjXPOqU2yG9hbDnmlnOszpKY	\N	\N	2026-06-21 00:48:46.695	f	2026-05-22 00:48:46.695889
4d7e621c-c19a-4991-83f6-6600de3854e3	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3NzkzOTIwOTQsImV4cCI6MTc4MTk4NDA5NH0.21qdl-gSVwrx4KTSRD8wR31y9ci8bAWWyWe7MLi2mcE	\N	\N	2026-06-21 01:04:54.987	f	2026-05-22 01:04:54.987714
97e36c16-8156-48ef-929c-1f5115e3afee	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk0MDg4MjYsImV4cCI6MTc4MjAwMDgyNn0.zZQyk3cEUv2XA8DkcW-qcMedR0gxPOmeAqSXA8lhs8g	\N	\N	2026-06-21 05:43:46.689	f	2026-05-22 05:43:46.690016
f8417126-b5e0-48b0-8e71-448d4dc5271d	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk0MzA4MjgsImV4cCI6MTc4MjAyMjgyOH0.28W2tCdAexFNcRZM2vTYScReQaLCCZO_n9aHeEhp5SI	\N	\N	2026-06-21 11:50:28.458	f	2026-05-22 11:50:28.458923
c163b344-2d41-461c-b8e1-d9274af25d91	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk0MzA4MjgsImV4cCI6MTc4MjAyMjgyOH0.28W2tCdAexFNcRZM2vTYScReQaLCCZO_n9aHeEhp5SI	\N	\N	2026-06-21 11:50:28.475	f	2026-05-22 11:50:28.475277
61bf374d-fec6-4d5a-b4f8-16bf273d14b2	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk0MzA4MzMsImV4cCI6MTc4MjAyMjgzM30.donH84CT6yiXiZl4okNV0b2-oZCL7OzyC8w12xf5ImE	\N	\N	2026-06-21 11:50:33.727	f	2026-05-22 11:50:33.727996
cf4bc572-a2b3-4644-b8c3-f39553764d34	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk0MzA4NDAsImV4cCI6MTc4MjAyMjg0MH0.IZYi_9SuUQ1typR-FXSKhobAiaRv8UsD1iBj2cMvru8	\N	\N	2026-06-21 11:50:40.095	f	2026-05-22 11:50:40.095995
86b97fd5-dfde-4e88-81a2-d328967aa6a5	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3Nzk0MzExNTMsImV4cCI6MTc4MjAyMzE1M30.op8ZPCQvAvLJFutV5_d2EWKJNgJdmW6Ao9p6B4-VfvY	\N	\N	2026-06-21 11:55:53.736	f	2026-05-22 11:55:53.736724
8f72ea16-c577-4fe5-8460-cb76a11f1811	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk0MzY2MTEsImV4cCI6MTc4MjAyODYxMX0._iEl0YTZebgI1VyMQ0X-ChMv0k_Ohk2mJxR0c8vqCNc	\N	\N	2026-06-21 13:26:51.98	f	2026-05-22 13:26:51.980381
273727cd-97e4-4c1d-87cc-6c77b4b1f804	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk0Mzc2MjMsImV4cCI6MTc4MjAyOTYyM30.9vnGWJRi5ZxzKNJwybYYOscZ1pxwGUAEgVgQzjAjL08	\N	\N	2026-06-21 13:43:43.823	f	2026-05-22 13:43:43.823637
d5ee63cc-4c02-4e00-90a1-e44a83658bca	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk0MzIzMzAsImV4cCI6MTc4MjAyNDMzMH0.dvo4Ba7PKtlse3k_rk1iuPyIyX5GGtrtoHsQwSQd7oY	\N	\N	2026-06-21 12:15:30.385	t	2026-05-22 12:15:30.385521
8bbcad14-9c06-485c-83ec-869700e74c66	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk0MzQ5ODYsImV4cCI6MTc4MjAyNjk4Nn0.SUHzZexMnbY_ktssOhLe5TXFpu9riio5-As7xGWWIAg	\N	\N	2026-06-21 12:59:46.824	f	2026-05-22 12:59:46.824622
bf93e3b2-fabf-471b-9afa-1685222d5f26	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3NzkzODM1MjcsImV4cCI6MTc4MTk3NTUyN30.iqkook1tz4q0KEtdsuMPyt_99-xjbsJ-eBnKepU2_UM	\N	\N	2026-06-20 22:42:07.425	f	2026-05-21 22:42:07.425767
800c0a57-1631-44ed-85dc-033727bc65e6	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3NzkzODQ0NjksImV4cCI6MTc4MTk3NjQ2OX0.-QTMNqmGmrGrekHXJ0UiQR7HNcm1no3LEuaM7XcOoyE	\N	\N	2026-06-20 22:57:49.13	f	2026-05-21 22:57:49.130434
25715dc3-06ae-4508-a72b-4ebea4d69972	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3NzkzODQ1MTIsImV4cCI6MTc4MTk3NjUxMn0.n2fhTUwOky66IESKZ6sAfGcMmXMvQwDFReockKN0D4M	\N	\N	2026-06-20 22:58:32.105	f	2026-05-21 22:58:32.105868
2c039c1c-ee2a-460f-8be1-6c0c2ce5b234	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3NzkzODQ1MTQsImV4cCI6MTc4MTk3NjUxNH0.aLN8hyXHke3t01H2K0sdpuKSIC2qeuhZkq5PkB0jYAs	\N	\N	2026-06-20 22:58:34.221	f	2026-05-21 22:58:34.221897
65e74047-e686-4282-af15-460e1f66f8b6	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3NzkzODUyNzgsImV4cCI6MTc4MTk3NzI3OH0.FxO9HQODc26hLeH86M0rixV-lPUV2Ni0KImpiD8ep3w	\N	\N	2026-06-20 23:11:18.981	t	2026-05-21 23:11:18.98206
561edd23-495c-4548-bd66-dba0d9b60c7a	50945a5f-b020-461a-8c47-63e74087c228	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI1MDk0NWE1Zi1iMDIwLTQ2MWEtOGM0Ny02M2U3NDA4N2MyMjgiLCJpYXQiOjE3NzkzODkwMjYsImV4cCI6MTc4MTk4MTAyNn0.gOUC06R7ZD8BX6GnU_zahxCSwTZ3_TVPaR9UF2ODBCc	\N	\N	2026-06-21 00:13:46.292	f	2026-05-22 00:13:46.292566
831f0815-a887-4fe7-b3c4-e1f8345d4d69	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3NzkzOTA0NDEsImV4cCI6MTc4MTk4MjQ0MX0.zRilRB1F7ICFfu7rcYGxtODI4tA3XcUpRPdAqxapDgw	\N	\N	2026-06-21 00:37:21.897	f	2026-05-22 00:37:21.897309
aca5bd55-49f4-420d-be23-0c118fdd0db4	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3NzkzOTA2NTcsImV4cCI6MTc4MTk4MjY1N30.jHi51Az6dNxry36CpO0Sbi2BbrhELo4cNcfUwijSHQ8	\N	\N	2026-06-21 00:40:57.027	f	2026-05-22 00:40:57.028106
bcefb1b6-843f-46fa-ad47-b59b76f4dc38	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3NzkzOTA3NzgsImV4cCI6MTc4MTk4Mjc3OH0.6VL2lvhs7weIuVn6db8wSAG_C_z0-ys9yJaw-m2oDHE	\N	\N	2026-06-21 00:42:58.219	f	2026-05-22 00:42:58.219786
262f52ff-760a-4ddb-872b-551827d44744	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3NzkzOTEwODAsImV4cCI6MTc4MTk4MzA4MH0.1Iar5or4Q8LcCti_RDTAEgZn7DyB6c4bMvwG_rnSWwo	\N	\N	2026-06-21 00:48:00.361	f	2026-05-22 00:48:00.361338
1c007a19-31f2-4f66-97cd-55db2ce5714f	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3NzkzOTExNDksImV4cCI6MTc4MTk4MzE0OX0.qn8xPDamv7ges0ALzHUBzkLcKpic-A4JVTzjWB_a-fQ	\N	\N	2026-06-21 00:49:09.762	f	2026-05-22 00:49:09.763507
68aa2222-d4c9-47b2-a0bd-bdd41c7e78e7	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3NzkzOTExNTcsImV4cCI6MTc4MTk4MzE1N30.oAqhwjyfy-8MaY7v7YD1_YWI-tBun8RB446oLusBqvw	\N	\N	2026-06-21 00:49:17.47	f	2026-05-22 00:49:17.4703
5d76aad2-4643-47c1-b69f-9371be2cbdef	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk0MDg4MDIsImV4cCI6MTc4MjAwMDgwMn0.YdaeI0HEqan2KPMXJ8HELoNP7wk05wnCW4VuRXn0OZg	\N	\N	2026-06-21 05:43:22.351	f	2026-05-22 05:43:22.352701
8f23d9a2-8d8f-498a-af34-dedc2e38e366	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk0MTM5MjIsImV4cCI6MTc4MjAwNTkyMn0.21heLBgDYB-v-75oq2cxnvGjutXkhV4rOSPVm-tjfd0	\N	\N	2026-06-21 07:08:42.354	t	2026-05-22 07:08:42.354911
ea33239f-7b65-4998-ad74-0d1ab25e35b0	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk0MzA4NDYsImV4cCI6MTc4MjAyMjg0Nn0.R1hsgJG-mGYfD-3R4dGG7TIFumpO3aYfqTjcQhrmA1s	\N	\N	2026-06-21 11:50:46.79	f	2026-05-22 11:50:46.79096
3fa061dc-084d-4f41-97ee-6726cc137929	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk0MzExNTksImV4cCI6MTc4MjAyMzE1OX0.ZUuUlYUEsPqsGlWBQiTh7COWZqNt1VF_45SocWnZvbo	\N	\N	2026-06-21 11:55:59.9	f	2026-05-22 11:55:59.900505
c22325de-a492-487a-94df-2be5006e8d59	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk0MzQ5ODYsImV4cCI6MTc4MjAyNjk4Nn0.SUHzZexMnbY_ktssOhLe5TXFpu9riio5-As7xGWWIAg	\N	\N	2026-06-21 12:59:46.82	f	2026-05-22 12:59:46.821133
a7abe2e5-18ba-42e9-ab65-c5f1f22685ee	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk0MzQ5ODYsImV4cCI6MTc4MjAyNjk4Nn0.SUHzZexMnbY_ktssOhLe5TXFpu9riio5-As7xGWWIAg	\N	\N	2026-06-21 12:59:46.825	f	2026-05-22 12:59:46.825317
22c429f7-14da-4c8a-9c6d-3f23bde9a381	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk0MzY1MDEsImV4cCI6MTc4MjAyODUwMX0.MZM0I78P70CW6lzLXgyyYuPXdCHfPw7IYhsrj2Tfq6Q	\N	\N	2026-06-21 13:25:01.967	f	2026-05-22 13:25:01.968067
2bcac59d-2555-4b4c-ae5d-e4a6b5df655b	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk0MzY3NDYsImV4cCI6MTc4MjAyODc0Nn0.oPsrhwOPKH63j-WzGFKALQGy0Jw3Yg1OBDrzmknJCoU	\N	\N	2026-06-21 13:29:06.685	f	2026-05-22 13:29:06.685575
1b03af75-3da9-48eb-a0aa-b4ffd5e4fc1f	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk0MzgwNTQsImV4cCI6MTc4MjAzMDA1NH0.HvrRscNjByLUAm8uSYcdr6uVmN8iQHZCXW7atPppg7c	\N	\N	2026-06-21 13:50:54.869	f	2026-05-22 13:50:54.870149
ffe15306-286a-4a80-bce6-1df8e48738d1	d263eb62-0c0f-458b-bf31-654549c58655	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJkMjYzZWI2Mi0wYzBmLTQ1OGItYmYzMS02NTQ1NDljNTg2NTUiLCJpYXQiOjE3Nzk0MzkwMDIsImV4cCI6MTc4MjAzMTAwMn0.3OFc23RN-hYaJ0eB7BrFsCUmER4WcgYCzxY6eaULr-o	\N	\N	2026-06-21 14:06:42.99	f	2026-05-22 14:06:42.991183
887dc6d8-b4c4-41bf-a9eb-afaf02898e03	d263eb62-0c0f-458b-bf31-654549c58655	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJkMjYzZWI2Mi0wYzBmLTQ1OGItYmYzMS02NTQ1NDljNTg2NTUiLCJpYXQiOjE3Nzk0Mzk2MDAsImV4cCI6MTc4MjAzMTYwMH0.J-zBtCY4Ahs2Yob4wlXVY1f2evfOBC2smxZCskQD9n0	\N	\N	2026-06-21 14:16:40.472	f	2026-05-22 14:16:40.472557
43fc718a-130b-49fb-b11c-ab282c5b930b	d263eb62-0c0f-458b-bf31-654549c58655	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJkMjYzZWI2Mi0wYzBmLTQ1OGItYmYzMS02NTQ1NDljNTg2NTUiLCJpYXQiOjE3Nzk0Mzk2MDAsImV4cCI6MTc4MjAzMTYwMH0.J-zBtCY4Ahs2Yob4wlXVY1f2evfOBC2smxZCskQD9n0	\N	\N	2026-06-21 14:16:40.474	f	2026-05-22 14:16:40.475
2e51a0dc-797c-41ab-a11f-2d5fc42a7540	d263eb62-0c0f-458b-bf31-654549c58655	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJkMjYzZWI2Mi0wYzBmLTQ1OGItYmYzMS02NTQ1NDljNTg2NTUiLCJpYXQiOjE3Nzk0Mzk2MTcsImV4cCI6MTc4MjAzMTYxN30.VhtMQaOsl5of1HlGcOrb5cCDvZxzPTYO6FVL-Ru46n8	\N	\N	2026-06-21 14:16:57.13	f	2026-05-22 14:16:57.130407
e1d4e136-20bf-4def-946f-aa5ba847be08	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk0NDAzMTMsImV4cCI6MTc4MjAzMjMxM30.CtalMaWaJa43ek4oQc5Si-tRAEjb2FdDF_yhlzc2wuw	\N	\N	2026-06-21 14:28:33.189	t	2026-05-22 14:28:33.189333
cff9ecd7-81bf-4783-b985-59668decd93d	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk0NDEyMTgsImV4cCI6MTc4MjAzMzIxOH0.Ct7FBEFkhibC9ExRtXBlvPkYFvJg4Ioy-zFFh1CoRNQ	\N	\N	2026-06-21 14:43:38.024	f	2026-05-22 14:43:38.02422
ac03cf01-e8b0-49b2-ae22-aaa68e333248	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk0NDEyMTgsImV4cCI6MTc4MjAzMzIxOH0.Ct7FBEFkhibC9ExRtXBlvPkYFvJg4Ioy-zFFh1CoRNQ	\N	\N	2026-06-21 14:43:38.024	f	2026-05-22 14:43:38.025027
146cd958-3886-4bca-bd16-0b692b5235e3	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3NzkzODQ0NjksImV4cCI6MTc4MTk3NjQ2OX0.-QTMNqmGmrGrekHXJ0UiQR7HNcm1no3LEuaM7XcOoyE	\N	\N	2026-06-20 22:57:49.13	f	2026-05-21 22:57:49.130906
6df5d42b-7038-45c5-b4d2-685c034a4c43	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3NzkzODQ1MjcsImV4cCI6MTc4MTk3NjUyN30.cpbWNMwWPLmDNsT3vz3NG6Gzj1n-Gt1N4vHhlIOxGSs	\N	\N	2026-06-20 22:58:47.955	f	2026-05-21 22:58:47.956217
a8c4cfce-20e1-4424-862b-008a08391427	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3NzkzODQ1MzAsImV4cCI6MTc4MTk3NjUzMH0.Noi69JcVBhMoe3Crnht21bQ5D-fx6aWoqhwP8l3zGes	\N	\N	2026-06-20 22:58:50.236	f	2026-05-21 22:58:50.237281
e46095d5-18df-44c8-8241-a1a74570438e	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3NzkzODYxOTAsImV4cCI6MTc4MTk3ODE5MH0.OQxus5rmPaZsfwkucMg-1LYZvTuXTFcgq9UDmPfKCfc	\N	\N	2026-06-20 23:26:30.14	t	2026-05-21 23:26:30.140442
64f5cba6-c0d7-4bd0-b7e4-506354ad7709	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3NzkzODkyMzMsImV4cCI6MTc4MTk4MTIzM30.gSk1wAcNaIfmsK3A7HhXMjAWQluoMJadxNiHgKWrG9s	\N	\N	2026-06-21 00:17:13.566	f	2026-05-22 00:17:13.566689
adec3f99-989a-40f3-a1e9-8624dde9dea4	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3NzkzODkyMzMsImV4cCI6MTc4MTk4MTIzM30.gSk1wAcNaIfmsK3A7HhXMjAWQluoMJadxNiHgKWrG9s	\N	\N	2026-06-21 00:17:13.64	f	2026-05-22 00:17:13.640613
21151084-25df-4122-912c-76370f27467c	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3NzkzOTA0NDEsImV4cCI6MTc4MTk4MjQ0MX0.zRilRB1F7ICFfu7rcYGxtODI4tA3XcUpRPdAqxapDgw	\N	\N	2026-06-21 00:37:21.897	f	2026-05-22 00:37:21.897902
c6c4caad-0c24-4b91-8f4e-9d01025fd05d	cb09b4e0-9caf-46d2-92a5-ec65452200d4	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjYjA5YjRlMC05Y2FmLTQ2ZDItOTJhNS1lYzY1NDUyMjAwZDQiLCJpYXQiOjE3NzkzOTA2NzEsImV4cCI6MTc4MTk4MjY3MX0.d7Ri7f3fOJiYd1EcmcXYcboc3t73oNXPXmb4rpXeOF4	\N	\N	2026-06-21 00:41:11.552	f	2026-05-22 00:41:11.552453
5382b07c-4f1e-4816-a043-9bb4ecccd4c3	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3NzkzOTA4NTUsImV4cCI6MTc4MTk4Mjg1NX0.5kGkyvamiEvMDI6vOme-UPG4xZ5AiRxr_of7KX6BbDw	\N	\N	2026-06-21 00:44:15.028	f	2026-05-22 00:44:15.028708
a007dd0c-ee62-44ce-94c4-885f51d1e018	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3NzkzOTExMTIsImV4cCI6MTc4MTk4MzExMn0.uA1IhGILff2hc8Duu_PRlXy4_Cym8Y89PUFP36HIx18	\N	\N	2026-06-21 00:48:32.017	f	2026-05-22 00:48:32.017933
433eab13-66b7-483e-9687-d8b921813649	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3NzkzOTExOTQsImV4cCI6MTc4MTk4MzE5NH0.lNnu4g3LC-0qlYCyrIfPDqKotrHx-HbRMLeZzCVqo48	\N	\N	2026-06-21 00:49:54.894	t	2026-05-22 00:49:54.895098
66b0ee1e-354f-4db2-9aef-ab9b52ff6fe2	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk0MDg4MTAsImV4cCI6MTc4MjAwMDgxMH0.AHD9oHn_pTCwIf82jcOPOdQSv2DJhO5Lbf9AvnExB1k	\N	\N	2026-06-21 05:43:30.773	t	2026-05-22 05:43:30.77391
db318c03-c526-41a7-abac-5ecf4b42c2fa	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk0MTM5MjIsImV4cCI6MTc4MjAwNTkyMn0.21heLBgDYB-v-75oq2cxnvGjutXkhV4rOSPVm-tjfd0	\N	\N	2026-06-21 07:08:42.355	f	2026-05-22 07:08:42.35575
5507a48b-f598-4085-bc75-638efec24203	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3Nzk0MzA4ODUsImV4cCI6MTc4MjAyMjg4NX0.LJnoWI5wwmd488HIIyX_d770JNOZ7Mxlc1kg_nomy6w	\N	\N	2026-06-21 11:51:25.529	f	2026-05-22 11:51:25.529314
3bff1c7f-af94-45b6-a8f3-b3da71a9ed57	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3Nzk0MzIwNjQsImV4cCI6MTc4MjAyNDA2NH0.AueOb18ZbCPfucHkue5Y8hkkV9wieWwM1GZJ8pcTxYk	\N	\N	2026-06-21 12:11:04.645	f	2026-05-22 12:11:04.645936
645092e8-4299-4c08-8964-ec4537134ebe	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk0MzQ5ODYsImV4cCI6MTc4MjAyNjk4Nn0.SUHzZexMnbY_ktssOhLe5TXFpu9riio5-As7xGWWIAg	\N	\N	2026-06-21 12:59:46.823	f	2026-05-22 12:59:46.823772
22b94fd7-ee2e-4eae-8bf9-da0297ca8a9a	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk0MzU1NjUsImV4cCI6MTc4MjAyNzU2NX0.bRHLUQG3Vm0tXTAOUQPmpg4iohBsUe_2mKuKTxozBVA	\N	\N	2026-06-21 13:09:25.06	f	2026-05-22 13:09:25.060318
03481fa3-02cb-4e7b-99b1-2e6116fbc951	d263eb62-0c0f-458b-bf31-654549c58655	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJkMjYzZWI2Mi0wYzBmLTQ1OGItYmYzMS02NTQ1NDljNTg2NTUiLCJpYXQiOjE3Nzk0Mzg1ODgsImV4cCI6MTc4MjAzMDU4OH0.MEIsMlQFcRnrTEp-A_qZtBXtiP02bAZvclY6E_NrJVg	\N	\N	2026-06-21 13:59:48.407	t	2026-05-22 13:59:48.408058
af84e464-9f3e-4c2f-b4da-79442c084925	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk0MzU1NzEsImV4cCI6MTc4MjAyNzU3MX0.P5lvfiy7z-xAWDy93NJ1uvClxBiVsgsI-pvYxTTNp3A	\N	\N	2026-06-21 13:09:31.752	t	2026-05-22 13:09:31.752282
cc5c3854-e164-4063-8a66-e83ca2bb595e	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk0MzY1MDEsImV4cCI6MTc4MjAyODUwMX0.MZM0I78P70CW6lzLXgyyYuPXdCHfPw7IYhsrj2Tfq6Q	\N	\N	2026-06-21 13:25:01.968	f	2026-05-22 13:25:01.968628
cf0f30f1-1a95-408f-ad4c-f1f2bb82317e	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk0Mzc1OTksImV4cCI6MTc4MjAyOTU5OX0._O7hTnAhewnOoEYncAnv9xB6PVXFVyKYo8TVlDkZSXQ	\N	\N	2026-06-21 13:43:19.999	f	2026-05-22 13:43:19.99996
91419a9b-df69-4018-8d60-74c9489d28ea	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk0Mzg0OTEsImV4cCI6MTc4MjAzMDQ5MX0.63rAWpYH5CCHN9Pvc_t3ZdnIkMCQip-3LfYX18vExX8	\N	\N	2026-06-21 13:58:11.057	f	2026-05-22 13:58:11.05811
302dc840-fe2b-423d-8193-f0f8d15b8b0c	d263eb62-0c0f-458b-bf31-654549c58655	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJkMjYzZWI2Mi0wYzBmLTQ1OGItYmYzMS02NTQ1NDljNTg2NTUiLCJpYXQiOjE3Nzk0Mzk2MDAsImV4cCI6MTc4MjAzMTYwMH0.J-zBtCY4Ahs2Yob4wlXVY1f2evfOBC2smxZCskQD9n0	\N	\N	2026-06-21 14:16:40.473	f	2026-05-22 14:16:40.473335
17363c56-9886-4df2-9755-a20cab1016d8	d263eb62-0c0f-458b-bf31-654549c58655	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJkMjYzZWI2Mi0wYzBmLTQ1OGItYmYzMS02NTQ1NDljNTg2NTUiLCJpYXQiOjE3Nzk0Mzk2MDAsImV4cCI6MTc4MjAzMTYwMH0.J-zBtCY4Ahs2Yob4wlXVY1f2evfOBC2smxZCskQD9n0	\N	\N	2026-06-21 14:16:40.473	f	2026-05-22 14:16:40.47401
10c5a081-bbd3-453a-9304-0cf04109b534	d263eb62-0c0f-458b-bf31-654549c58655	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJkMjYzZWI2Mi0wYzBmLTQ1OGItYmYzMS02NTQ1NDljNTg2NTUiLCJpYXQiOjE3Nzk0Mzk2MDAsImV4cCI6MTc4MjAzMTYwMH0.J-zBtCY4Ahs2Yob4wlXVY1f2evfOBC2smxZCskQD9n0	\N	\N	2026-06-21 14:16:40.475	f	2026-05-22 14:16:40.475911
2720f2b0-430d-4f8f-aff2-fb7bd948323c	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk0NDEyMTgsImV4cCI6MTc4MjAzMzIxOH0.Ct7FBEFkhibC9ExRtXBlvPkYFvJg4Ioy-zFFh1CoRNQ	\N	\N	2026-06-21 14:43:38.023	t	2026-05-22 14:43:38.023656
7d767e63-8569-460e-b8e0-cdfd70f3fa5d	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk0NDIxMjcsImV4cCI6MTc4MjAzNDEyN30.tn6obrjHHKDMrnPT4yDvRDgYBaRwDTxm_NmOGgSW8G8	\N	\N	2026-06-21 14:58:47.173	f	2026-05-22 14:58:47.173511
ce2ac257-be36-44d9-93f2-98eec17b5325	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk0NDIxMjcsImV4cCI6MTc4MjAzNDEyN30.tn6obrjHHKDMrnPT4yDvRDgYBaRwDTxm_NmOGgSW8G8	\N	\N	2026-06-21 14:58:47.173	f	2026-05-22 14:58:47.174093
a629b519-6715-462f-9fe5-567ef1d8366f	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk0NDIxMjcsImV4cCI6MTc4MjAzNDEyN30.tn6obrjHHKDMrnPT4yDvRDgYBaRwDTxm_NmOGgSW8G8	\N	\N	2026-06-21 14:58:47.174	f	2026-05-22 14:58:47.175023
0540a955-c32f-43c2-ae91-7d60ffb2a251	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk0NDIxMjcsImV4cCI6MTc4MjAzNDEyN30.tn6obrjHHKDMrnPT4yDvRDgYBaRwDTxm_NmOGgSW8G8	\N	\N	2026-06-21 14:58:47.172	t	2026-05-22 14:58:47.172945
200ba4f0-859c-4d8b-83fd-84d1fff704af	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk0NDM4NjMsImV4cCI6MTc4MjAzNTg2M30.28jrSQJN2mz4_7yFBpdNSPR4v-CtWsYqLBr8QrRN0T8	\N	\N	2026-06-21 15:27:43.345	f	2026-05-22 15:27:43.345986
53b3501d-e3c5-49f4-928c-6d4fa1727b3c	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk0NDM4NzUsImV4cCI6MTc4MjAzNTg3NX0.8j2PzdF1p23e63tzPLs-mrOR_1f26jzt1-9VdeHrYD4	\N	\N	2026-06-21 15:27:55.243	f	2026-05-22 15:27:55.243855
e4a628c2-6261-4966-9940-c563e9242bac	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk0NDM5NTUsImV4cCI6MTc4MjAzNTk1NX0.L8wHzVjv8t-cRp2vLz9fT-pkyLpbQj2mBREQAZlFfR8	\N	\N	2026-06-21 15:29:15.205	f	2026-05-22 15:29:15.205703
ca4ad7b9-7a35-4309-b262-a0541e98b2ef	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk0NDQwNjAsImV4cCI6MTc4MjAzNjA2MH0.nCMLTja2f_yTFoPqUsGepD00MN_knlzNnplaTPNYvdY	\N	\N	2026-06-21 15:31:00.597	f	2026-05-22 15:31:00.598016
d6c932bc-27af-4732-bb67-1e8d1eee7779	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk0NDU0ODYsImV4cCI6MTc4MjAzNzQ4Nn0.BZiWXC2ysVVsoE_WBJcWwHgJDc_cckhjO73U_ejypds	\N	\N	2026-06-21 15:54:46.498	t	2026-05-22 15:54:46.502362
9dcac64c-d66c-4403-8136-63938aa86a73	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk0NDMwMzIsImV4cCI6MTc4MjAzNTAzMn0.biAq_ulkBtH8R7FhCkz44Zc5sAnLzbfOE3w_2IFy8AY	\N	\N	2026-06-21 15:13:52.807	t	2026-05-22 15:13:52.807377
a111b72a-b6ee-413d-b185-1bfb55d12c3e	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk0NDQwOTAsImV4cCI6MTc4MjAzNjA5MH0.CygqOXHFF-9cYrEIUxn5GGciSw2f_4Kz6UEHW-V0AJA	\N	\N	2026-06-21 15:31:30.096	f	2026-05-22 15:31:30.096547
8586828e-0e99-481b-abc1-5656d4bff585	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk0NDQwOTAsImV4cCI6MTc4MjAzNjA5MH0.CygqOXHFF-9cYrEIUxn5GGciSw2f_4Kz6UEHW-V0AJA	\N	\N	2026-06-21 15:31:30.096	f	2026-05-22 15:31:30.096922
c73c95d2-2b79-48da-be97-99c8ef8d8791	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk0NDQwOTAsImV4cCI6MTc4MjAzNjA5MH0.CygqOXHFF-9cYrEIUxn5GGciSw2f_4Kz6UEHW-V0AJA	\N	\N	2026-06-21 15:31:30.097	f	2026-05-22 15:31:30.097323
3533c86d-9d0f-4f99-a016-8151ee87d55e	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk0NDQwOTAsImV4cCI6MTc4MjAzNjA5MH0.CygqOXHFF-9cYrEIUxn5GGciSw2f_4Kz6UEHW-V0AJA	\N	\N	2026-06-21 15:31:30.095	t	2026-05-22 15:31:30.095938
53c1cb9c-64fd-4ada-9882-1ea58e958831	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk0NDU0ODYsImV4cCI6MTc4MjAzNzQ4Nn0.BZiWXC2ysVVsoE_WBJcWwHgJDc_cckhjO73U_ejypds	\N	\N	2026-06-21 15:54:46.497	f	2026-05-22 15:54:46.502295
ef7a6b7b-0b6a-4958-8643-b9e9f141fc53	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk0NDU0ODYsImV4cCI6MTc4MjAzNzQ4Nn0.BZiWXC2ysVVsoE_WBJcWwHgJDc_cckhjO73U_ejypds	\N	\N	2026-06-21 15:54:46.498	f	2026-05-22 15:54:46.502575
a982d556-dd25-40de-a7ae-d7a9e926489e	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk0NDU0ODYsImV4cCI6MTc4MjAzNzQ4Nn0.BZiWXC2ysVVsoE_WBJcWwHgJDc_cckhjO73U_ejypds	\N	\N	2026-06-21 15:54:46.504	f	2026-05-22 15:54:46.505099
b712fce6-957f-4109-9077-ab1ee231537e	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk0NDYzNzAsImV4cCI6MTc4MjAzODM3MH0.auT-nXVYYuwj8GpYJQ_XkZe00W2y22jafX7wHwy_TMA	\N	\N	2026-06-21 16:09:30.22	f	2026-05-22 16:09:30.220522
7292f547-7ca7-45f9-977e-52dd39b7f356	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk0NDYzOTYsImV4cCI6MTc4MjAzODM5Nn0.NvWT_UjPuVOJ5PGaU4qqn5otCi0G6tVWOsxes1CR1E4	\N	\N	2026-06-21 16:09:56.049	f	2026-05-22 16:09:56.049187
06c47b26-79e8-46c2-960b-2a075af69b7c	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk0NDYzOTYsImV4cCI6MTc4MjAzODM5Nn0.NvWT_UjPuVOJ5PGaU4qqn5otCi0G6tVWOsxes1CR1E4	\N	\N	2026-06-21 16:09:56.049	f	2026-05-22 16:09:56.049866
08805edb-a688-4826-905b-f1f6f4300de8	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk0NDYzOTYsImV4cCI6MTc4MjAzODM5Nn0.NvWT_UjPuVOJ5PGaU4qqn5otCi0G6tVWOsxes1CR1E4	\N	\N	2026-06-21 16:09:56.05	f	2026-05-22 16:09:56.050613
682ed77a-3bea-414d-a23e-4f9a1d9477b9	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk0NDYzOTksImV4cCI6MTc4MjAzODM5OX0.9U3dUK3ACigIPmoV5oUJk7FausH1tk0KJuOq2mZ8JIA	\N	\N	2026-06-21 16:09:59.357	f	2026-05-22 16:09:59.357355
e60a09b7-725d-46ef-9f3d-9d92636d6da3	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk0NDY0MDIsImV4cCI6MTc4MjAzODQwMn0.9oQRmKiRWHts6rH58ngx7oOEezhEbXF3Ch_j_0AP6LY	\N	\N	2026-06-21 16:10:02.849	f	2026-05-22 16:10:02.849624
e521322d-7edb-4147-877f-2d56563768c8	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk0NDY0MDcsImV4cCI6MTc4MjAzODQwN30.WZvqXMkEOvApOdhm-67itsTl_K0asQu4Avuh1Z5khsQ	\N	\N	2026-06-21 16:10:07.415	f	2026-05-22 16:10:07.416034
f6f8aeef-9a44-4eea-b028-dc528ad1edf5	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk0NDY1MTksImV4cCI6MTc4MjAzODUxOX0.P9jhCQ1yLgQfyV8gdU-wXO-jDl7I8LfnEcPPshx2R0U	\N	\N	2026-06-21 16:11:59.664	f	2026-05-22 16:11:59.664892
765501b8-72d2-4010-95f7-c873c4c974d2	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk0NDY1MjgsImV4cCI6MTc4MjAzODUyOH0.57QUx1-FOt6x7femMKvqkIKqKDzMH7WubTDmkU9hbFo	\N	\N	2026-06-21 16:12:08.9	f	2026-05-22 16:12:08.901234
879ec1dc-95e5-46a9-90af-18abe51290fa	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk0NDY1MzEsImV4cCI6MTc4MjAzODUzMX0.DKWJYb7ZW0iQ5G1t-Gh8jrjfbrhCGw7RTkX9N4hfCVA	\N	\N	2026-06-21 16:12:11.356	f	2026-05-22 16:12:11.356906
96f4bf39-3926-40a3-ba41-92be876a1780	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3Nzk0NDY1NDMsImV4cCI6MTc4MjAzODU0M30.d5szGgFNw7jjro2OuGk7Uob_8dujk1VWhMs_V7Fn3gs	\N	\N	2026-06-21 16:12:23.449	f	2026-05-22 16:12:23.449527
d21c6ecc-ea3d-4881-a610-68e52ed8eeab	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk0NDY1NTAsImV4cCI6MTc4MjAzODU1MH0.MwRUzFPjLSnf3gFPNnpDnIScobkx041jDn44LC2OAMk	\N	\N	2026-06-21 16:12:30.705	f	2026-05-22 16:12:30.705997
1933d52e-b77b-45b5-93ee-b15d23cfdc35	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3Nzk0NDY1NTcsImV4cCI6MTc4MjAzODU1N30.FGztyURcXT_8Tbz25zUapjRQAsOAnjKSh81yShHvjg4	\N	\N	2026-06-21 16:12:37.637	f	2026-05-22 16:12:37.638087
4f9e5c38-4267-4446-9426-e055ed3bef16	d263eb62-0c0f-458b-bf31-654549c58655	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJkMjYzZWI2Mi0wYzBmLTQ1OGItYmYzMS02NTQ1NDljNTg2NTUiLCJpYXQiOjE3Nzk0NDY1NzMsImV4cCI6MTc4MjAzODU3M30.N8_5Kk7a1_9oBXAv_9TF8kL5_8hGvxBGHr7Kbn-m2zE	\N	\N	2026-06-21 16:12:53.067	t	2026-05-22 16:12:53.067362
2d69df92-8aa2-4b08-b7d8-128e11368b07	d263eb62-0c0f-458b-bf31-654549c58655	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJkMjYzZWI2Mi0wYzBmLTQ1OGItYmYzMS02NTQ1NDljNTg2NTUiLCJpYXQiOjE3Nzk0NDkxMTAsImV4cCI6MTc4MjA0MTExMH0.XvFcIKyVUOEd9oa6r9nC0J1HPQsmypvEW-odUzFNf2A	\N	\N	2026-06-21 16:55:10.415	f	2026-05-22 16:55:10.419355
524ca375-acd7-462c-9744-df7e9536f232	d263eb62-0c0f-458b-bf31-654549c58655	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJkMjYzZWI2Mi0wYzBmLTQ1OGItYmYzMS02NTQ1NDljNTg2NTUiLCJpYXQiOjE3Nzk0NDkxMTAsImV4cCI6MTc4MjA0MTExMH0.XvFcIKyVUOEd9oa6r9nC0J1HPQsmypvEW-odUzFNf2A	\N	\N	2026-06-21 16:55:10.416	f	2026-05-22 16:55:10.418117
2ac5d090-fe59-410b-b619-93a5730bda24	d263eb62-0c0f-458b-bf31-654549c58655	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJkMjYzZWI2Mi0wYzBmLTQ1OGItYmYzMS02NTQ1NDljNTg2NTUiLCJpYXQiOjE3Nzk0NDkxMTAsImV4cCI6MTc4MjA0MTExMH0.XvFcIKyVUOEd9oa6r9nC0J1HPQsmypvEW-odUzFNf2A	\N	\N	2026-06-21 16:55:10.421	f	2026-05-22 16:55:10.421642
177e838e-77f3-4451-92e0-f5ccd40d6889	d263eb62-0c0f-458b-bf31-654549c58655	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJkMjYzZWI2Mi0wYzBmLTQ1OGItYmYzMS02NTQ1NDljNTg2NTUiLCJpYXQiOjE3Nzk0NDkxMTAsImV4cCI6MTc4MjA0MTExMH0.XvFcIKyVUOEd9oa6r9nC0J1HPQsmypvEW-odUzFNf2A	\N	\N	2026-06-21 16:55:10.422	f	2026-05-22 16:55:10.422177
0ea45b96-de4e-4534-bfb2-64d9e8ddc61c	d263eb62-0c0f-458b-bf31-654549c58655	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJkMjYzZWI2Mi0wYzBmLTQ1OGItYmYzMS02NTQ1NDljNTg2NTUiLCJpYXQiOjE3Nzk0NDkxMTAsImV4cCI6MTc4MjA0MTExMH0.XvFcIKyVUOEd9oa6r9nC0J1HPQsmypvEW-odUzFNf2A	\N	\N	2026-06-21 16:55:10.423	f	2026-05-22 16:55:10.423397
26f2f54e-f251-4cf7-949a-223a10c892f9	d263eb62-0c0f-458b-bf31-654549c58655	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJkMjYzZWI2Mi0wYzBmLTQ1OGItYmYzMS02NTQ1NDljNTg2NTUiLCJpYXQiOjE3Nzk0NDkxMTAsImV4cCI6MTc4MjA0MTExMH0.XvFcIKyVUOEd9oa6r9nC0J1HPQsmypvEW-odUzFNf2A	\N	\N	2026-06-21 16:55:10.423	f	2026-05-22 16:55:10.423894
e98c41f1-614b-45f8-8653-4ea09805b8e4	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk0NDkxMzgsImV4cCI6MTc4MjA0MTEzOH0.G3GxbVDm6f2HT0HeHpgdAwuRHHjhpH4oUsY50BP1ZT8	\N	\N	2026-06-21 16:55:38.706	f	2026-05-22 16:55:38.70712
b291f621-a928-48e2-9e92-5705cf644671	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk0NDkxNDYsImV4cCI6MTc4MjA0MTE0Nn0.NWgaPupMLtQwfpdS8vE1SDrJ_gaAbgoLD7fWFVkZrLc	\N	\N	2026-06-21 16:55:46.75	f	2026-05-22 16:55:46.750696
dc4987ec-1c2d-4b9e-8240-a69ad2e9156a	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk0NDkxNjIsImV4cCI6MTc4MjA0MTE2Mn0.Fq-MGmtKYesqpSWahU2R29nex9WSC-ASHC0H8Y6hcEg	\N	\N	2026-06-21 16:56:02.232	t	2026-05-22 16:56:02.232901
82fc580a-d418-46d0-95de-4293b3c72e36	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk0NTEwNDEsImV4cCI6MTc4MjA0MzA0MX0.0pxH-nsZElpTl87YdGgD46_66HjnlgYgCDVBqvdhj7k	\N	\N	2026-06-21 17:27:21.174	f	2026-05-22 17:27:21.175024
fe4ef02c-4b56-40c3-937c-b76a0aa3d5bd	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk0NTEwNDEsImV4cCI6MTc4MjA0MzA0MX0.0pxH-nsZElpTl87YdGgD46_66HjnlgYgCDVBqvdhj7k	\N	\N	2026-06-21 17:27:21.175	f	2026-05-22 17:27:21.175639
e3788e5a-2671-4dbb-a387-b1472d3ddaa7	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk0NTEwNDEsImV4cCI6MTc4MjA0MzA0MX0.0pxH-nsZElpTl87YdGgD46_66HjnlgYgCDVBqvdhj7k	\N	\N	2026-06-21 17:27:21.176	f	2026-05-22 17:27:21.17609
e3116b53-47b7-4bcd-86d3-8113592d8aae	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk0NTEwNDEsImV4cCI6MTc4MjA0MzA0MX0.0pxH-nsZElpTl87YdGgD46_66HjnlgYgCDVBqvdhj7k	\N	\N	2026-06-21 17:27:21.176	f	2026-05-22 17:27:21.176845
458fbed6-e6f0-4d1b-88f2-c5d966be9a57	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk0NTExODUsImV4cCI6MTc4MjA0MzE4NX0.Z_MIYdYrWKKk7nckdFhM6zNoubr2EJgv3fA0JHQa3dE	\N	\N	2026-06-21 17:29:45.684	f	2026-05-22 17:29:45.684785
3beb50ad-3896-41b3-b1a2-61ef908e9846	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk0NTEyNjMsImV4cCI6MTc4MjA0MzI2M30.GJcc6RTnlKNc8Jgl93SwW0hpIijbhphoPy10EbqLwYU	\N	\N	2026-06-21 17:31:03.989	f	2026-05-22 17:31:03.989597
9c058736-db38-4ddd-979e-a9fb5b1e4e71	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk0NTE0MDMsImV4cCI6MTc4MjA0MzQwM30.NlMSaAzl46OATAWIr6IFnUz_BZzVMS3QqjW6HKoH9iw	\N	\N	2026-06-21 17:33:23.305	f	2026-05-22 17:33:23.3062
221cc33d-8239-4200-99ba-82b54ffb7dbd	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk0NTE0MzMsImV4cCI6MTc4MjA0MzQzM30.B1v4P6FH_w2Vuy_c1NHeuAjRQB6r-X3jsTzSjaSvdds	\N	\N	2026-06-21 17:33:53.122	f	2026-05-22 17:33:53.12294
c90f2463-f2e8-425d-8e85-93694bba626e	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk0NTE1MDgsImV4cCI6MTc4MjA0MzUwOH0.5XNimFH8hH0fmzHBZxPgpXVKUpYVEzufOIgyKf0VklU	\N	\N	2026-06-21 17:35:08.625	f	2026-05-22 17:35:08.625617
a85dcaee-a768-447d-b130-9fac55828f06	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk0NTE1MzAsImV4cCI6MTc4MjA0MzUzMH0.SehSFf_tWzEEw0FrC8ykrZB5jyuQUjaFkwZS7Vp3Ais	\N	\N	2026-06-21 17:35:30.514	f	2026-05-22 17:35:30.514434
35815b2d-771b-472c-aab6-0c8e0fbc024e	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk0NTE1MzQsImV4cCI6MTc4MjA0MzUzNH0.BEvQHaM9yZ3gbkzDA8I79vLg8b2Rs5nMRLfJ3wsdJRE	\N	\N	2026-06-21 17:35:34.927	f	2026-05-22 17:35:34.927564
94b96171-07da-4757-845b-27f26ad19f61	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk0NTIyNDMsImV4cCI6MTc4MjA0NDI0M30.fTUmI1gtDSvYQ9dVMWarVQMCsrimekqgVWi92x0N3tE	\N	\N	2026-06-21 17:47:23.663	f	2026-05-22 17:47:23.664015
dd00e0db-3182-428e-b9c6-cdcc4cc71b95	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk0NTIyNDksImV4cCI6MTc4MjA0NDI0OX0.fNfhqK9fplA0y2U_ZSECG-SbX83qRFfyOyYDLacllQs	\N	\N	2026-06-21 17:47:29.063	f	2026-05-22 17:47:29.063441
342c6895-6e58-4620-9548-a102f58a9236	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk0NTIyNzAsImV4cCI6MTc4MjA0NDI3MH0.NZAJHFSyuFy-VxoDbr5AMdfu9qxFsp4YvczPDokoVqE	\N	\N	2026-06-21 17:47:50.527	f	2026-05-22 17:47:50.528025
e75a4583-1c3d-4eab-b084-6290fa7b4a73	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk0NTIzNDMsImV4cCI6MTc4MjA0NDM0M30.k9T5A__mBxRXTASSrnYwnEGsYeVVbuzd5rZ4LpfUSFo	\N	\N	2026-06-21 17:49:03.557	f	2026-05-22 17:49:03.557342
bb510f29-9d8c-452a-95b3-3e4e6603266f	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk0NTIzNDYsImV4cCI6MTc4MjA0NDM0Nn0.U6efuBcFZ0-RzeEthsY3k77iu3kA2iO7voVpW7MRJ2A	\N	\N	2026-06-21 17:49:06.171	f	2026-05-22 17:49:06.171923
554226ff-16d0-403d-8c22-abdcc211aca4	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk0NTI0OTksImV4cCI6MTc4MjA0NDQ5OX0.oZnjuYmgeKy9z3gzX37CfQ6kUdLzlhHKCe6OyAXTt5c	\N	\N	2026-06-21 17:51:39.12	f	2026-05-22 17:51:39.12101
7cb6ad65-49d0-4313-84a2-3bea54f4353a	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3Nzk0NTI1MzIsImV4cCI6MTc4MjA0NDUzMn0.rUE57L5w9cxC7kq3CbggM5IwaDrXNJSeFWpeY_9-NFc	\N	\N	2026-06-21 17:52:12.983	f	2026-05-22 17:52:12.983982
2d00fdac-5aff-4ecc-88e1-1a09352298ca	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk0NTI1NTksImV4cCI6MTc4MjA0NDU1OX0.IteusUnQMlWe-N_g3hhsP6_yc6AAknoZGI2HzeW2Jgs	\N	\N	2026-06-21 17:52:39.317	f	2026-05-22 17:52:39.317429
91ce09a2-d249-42fa-86be-a98efc40618d	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk0NTMwODEsImV4cCI6MTc4MjA0NTA4MX0.pri7mjINRNooX1nVnbkP3dxk_ryueYbMiNtuUv1i7IM	\N	\N	2026-06-21 18:01:21.826	f	2026-05-22 18:01:21.826758
84182fc4-a202-4075-bf81-965b3122c2cc	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3Nzk0NTMxNDQsImV4cCI6MTc4MjA0NTE0NH0.8KYGfugS1im77uxtQEZ7rgwf7bxfyBtuzX6ZsHdrfSk	\N	\N	2026-06-21 18:02:24.198	f	2026-05-22 18:02:24.19903
c3045bd8-42e4-49eb-ae76-e6bb144cec9b	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk0NTM5MzEsImV4cCI6MTc4MjA0NTkzMX0.vLifihKun7XZNnPpCz64y3hMHaUzB26Jf3SnGZFmNuo	\N	\N	2026-06-21 18:15:31.174	t	2026-05-22 18:15:31.174901
d1428606-f9ec-4488-8c0c-76726130ceb3	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk0NTQ4NTYsImV4cCI6MTc4MjA0Njg1Nn0.JomC6h5TDQI59JCI3qE4ZFjgJ0ldoHcu9r5l8oRW7d8	\N	\N	2026-06-21 18:30:56.79	f	2026-05-22 18:30:56.790453
dd282188-3b45-405b-87b3-4d73e817078a	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk0NTQ4NTgsImV4cCI6MTc4MjA0Njg1OH0.-JTmV7NCtuUYA6WVZpgCQ5cYTfuJPecxCL4VkC2k7TI	\N	\N	2026-06-21 18:30:58.899	f	2026-05-22 18:30:58.899717
ba070bec-6425-45ff-97f6-7a80befb010f	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk0NTUwMzksImV4cCI6MTc4MjA0NzAzOX0.qVe04lKKTH8blq1r4beFdcZjVMSkLgoorEuo8QjQdCc	\N	\N	2026-06-21 18:33:59.942	f	2026-05-22 18:33:59.942762
08e258b9-7031-4ff7-8e0f-707b4a306e12	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3Nzk0NTUwODMsImV4cCI6MTc4MjA0NzA4M30.9sE6sFnymTYpg2Ke5WvJ_KspVlMz8RdtmeLnf2Ih8Cc	\N	\N	2026-06-21 18:34:43.637	f	2026-05-22 18:34:43.637487
2d895ca7-3b9a-4776-9c72-dc5b447ed850	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk0NTUyMTksImV4cCI6MTc4MjA0NzIxOX0.PSkMLN84NQorhfU8tRuNJ7A0itxsAMKIf1Nlmp1HqCA	\N	\N	2026-06-21 18:36:59.159	f	2026-05-22 18:36:59.159661
049a7200-923e-42e2-8e5d-ca47a9ec1a56	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk0NTUyMzIsImV4cCI6MTc4MjA0NzIzMn0.nwwoVwxW3mTXFrynqX0Wcszzc6GHFSgu9o8X7dORSVQ	\N	\N	2026-06-21 18:37:12.511	f	2026-05-22 18:37:12.512035
434b2bac-7fd7-43b9-a063-a69b0c4dd47b	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3Nzk0NTY0MzksImV4cCI6MTc4MjA0ODQzOX0.AVhw-5zky2309thTlW7E3EWxP6QaPmbkyW9h3NAX0r0	\N	\N	2026-06-21 18:57:19.619	f	2026-05-22 18:57:19.619971
eb213cd0-68ba-4831-a9f3-d9721021154c	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk0NTY2NDIsImV4cCI6MTc4MjA0ODY0Mn0.omhxqw7MKJzgmMGPSBwOfbzpm2flgoc4hoXpxDvhzZg	\N	\N	2026-06-21 19:00:42.972	f	2026-05-22 19:00:42.972425
08dba403-a92f-44bd-ad93-922bad883c5d	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk0NTcxNjYsImV4cCI6MTc4MjA0OTE2Nn0.K_1Gafd2fB62beN030aRvmtfr6bpg586HRNI5TUKi50	\N	\N	2026-06-21 19:09:26.038	f	2026-05-22 19:09:26.038476
565117de-8b15-48ae-bf38-58c6d8f4faa7	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk0NTcxNzAsImV4cCI6MTc4MjA0OTE3MH0.fBSRyoYNjXuEClf_-FfqyAI_rUJwYcLuC6Jytl1X2ng	\N	\N	2026-06-21 19:09:30.951	f	2026-05-22 19:09:30.951215
a3c1417b-a0dd-49c1-b9c5-363bd99fae69	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk0NTcxODAsImV4cCI6MTc4MjA0OTE4MH0.6XO_3GEwQdPKuTSmd0saaOZtHNYZtzqNVpBxxP8nfKU	\N	\N	2026-06-21 19:09:40.583	f	2026-05-22 19:09:40.584243
f64be509-4fec-4e93-81f5-2cdad826ce9d	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk0NTcxODksImV4cCI6MTc4MjA0OTE4OX0.F9dm9asYHALCrvdA0dm1v4jPjlgbyk7QYwzLnnQKlAE	\N	\N	2026-06-21 19:09:49.891	f	2026-05-22 19:09:49.891663
443461fc-5e07-411f-af7e-aa8f3b499c46	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk0NTcxOTUsImV4cCI6MTc4MjA0OTE5NX0._81oCSgBHRxGDLUNQKvckcDfDbCTIVH69F8pF2P0nYY	\N	\N	2026-06-21 19:09:55.041	f	2026-05-22 19:09:55.041861
178e2e21-d99a-4454-a364-93b3b65df5d2	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3Nzk0NTcyMDEsImV4cCI6MTc4MjA0OTIwMX0.G2iWtggm1ewY1EwqwwxmTD3dRZuWwUf1Z-J7vESW5RM	\N	\N	2026-06-21 19:10:01.213	f	2026-05-22 19:10:01.214504
f347c4d0-3311-47af-b4d9-57e73d75231c	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk0NTcyNDMsImV4cCI6MTc4MjA0OTI0M30.7xL21BYFDOE5853sw5Emu5tdjYYi5KLQzsTqQGIwaZg	\N	\N	2026-06-21 19:10:43.453	t	2026-05-22 19:10:43.454118
f5af8a1d-8ae0-4136-8676-04d0a451b6b3	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk0NTgxNTcsImV4cCI6MTc4MjA1MDE1N30.sOfx2F1GGmtt2y7vO_a29lUQAJJREflWEeZuKgiybwU	\N	\N	2026-06-21 19:25:57.564	f	2026-05-22 19:25:57.564706
ff1c9c56-d617-4dd2-beb8-480ce181ccbd	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk0NTgxNTcsImV4cCI6MTc4MjA1MDE1N30.sOfx2F1GGmtt2y7vO_a29lUQAJJREflWEeZuKgiybwU	\N	\N	2026-06-21 19:25:57.565	f	2026-05-22 19:25:57.565344
182a0ab7-8866-44f3-a6bc-dbef10c0a4dd	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk0NTgxNTcsImV4cCI6MTc4MjA1MDE1N30.sOfx2F1GGmtt2y7vO_a29lUQAJJREflWEeZuKgiybwU	\N	\N	2026-06-21 19:25:57.566	f	2026-05-22 19:25:57.566926
23298443-32f3-4b81-af61-5d8364e8fd8f	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk0NTgxNTcsImV4cCI6MTc4MjA1MDE1N30.sOfx2F1GGmtt2y7vO_a29lUQAJJREflWEeZuKgiybwU	\N	\N	2026-06-21 19:25:57.568	f	2026-05-22 19:25:57.569042
96dfc1c7-5f9b-4dd4-a574-5b3eabb61f3c	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk0NTgxNTksImV4cCI6MTc4MjA1MDE1OX0.1JscCNxUG06xCU9g4udxqEQIP6zsDofTBVhl6E8SWJ0	\N	\N	2026-06-21 19:25:59.841	f	2026-05-22 19:25:59.841322
de0d709a-4885-44fa-9014-b70a40f5429a	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk0NTg2MzksImV4cCI6MTc4MjA1MDYzOX0.eX3XaObMaJi8kPnZ__XszCuyq-M64VdOsOXexYm0jg4	\N	\N	2026-06-21 19:33:59.761	f	2026-05-22 19:33:59.761761
388ee541-07aa-4996-bdd2-b4a5d11491a1	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3Nzk0NTg2ODUsImV4cCI6MTc4MjA1MDY4NX0.Fw83jlyQOc3M0SbYLwqxq9Xysw9YickFuHcSHy_Z4rE	\N	\N	2026-06-21 19:34:45.196	f	2026-05-22 19:34:45.196722
24f6e4ce-36c6-4e74-8d96-4130d5fe2749	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk0NTg3MjUsImV4cCI6MTc4MjA1MDcyNX0.k0UeseptxnQuaPFphJfihVzyZENpwnhEtbqrgWWUm4w	\N	\N	2026-06-21 19:35:25.499	f	2026-05-22 19:35:25.499185
65b4fd2c-db1b-4313-be22-72374b71601d	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3Nzk0NTkzMjIsImV4cCI6MTc4MjA1MTMyMn0.FhNeGUq-zELnDiWTvNevlcs1Nfc084aGUX7YDIJBgR4	\N	\N	2026-06-21 19:45:22.213	f	2026-05-22 19:45:22.2137
8ea4430b-f6c2-4df9-ac6d-4bf803921f17	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk0NTkzODEsImV4cCI6MTc4MjA1MTM4MX0.uiKdPPul-VOo_HMuMBwz4aKlazWS1fSDAo0L8oH5NRw	\N	\N	2026-06-21 19:46:21.519	t	2026-05-22 19:46:21.519496
a7a004ac-eb9a-4337-a9a3-9636b9723f9f	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk0NjAzNDQsImV4cCI6MTc4MjA1MjM0NH0._ClvIBOQJSysS5Ge8FEozxVFSy7VRidVcGWBy2snb4Q	\N	\N	2026-06-21 20:02:24.665	f	2026-05-22 20:02:24.665476
1c8d955a-5173-4936-ad70-d32d4fde4bff	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk0NjA1MDIsImV4cCI6MTc4MjA1MjUwMn0.6Cs9LT4_UWJDdhbTFHdj7aeolmpYgMCELYgsf4CB9K0	\N	\N	2026-06-21 20:05:02.648	f	2026-05-22 20:05:02.648372
46e7bbee-4e54-4d4c-b1db-f4d1ab00c870	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk0NjA1MDYsImV4cCI6MTc4MjA1MjUwNn0.KSKu3FzFIGEAnS0IVBaYWXTZNp7-fItaSU0sKx8rzgY	\N	\N	2026-06-21 20:05:06.83	f	2026-05-22 20:05:06.831133
3d1c5ec9-b1ae-47b1-8cec-1669859a53fd	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk0NjA3MTYsImV4cCI6MTc4MjA1MjcxNn0.flIrq0SJ5BZzLMRmm4YXVffFm3l9lUN1GjJLaE371LU	\N	\N	2026-06-21 20:08:36.299	f	2026-05-22 20:08:36.299724
94d8726c-4843-4379-a61d-bf99f3291a94	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk0NjA3MTcsImV4cCI6MTc4MjA1MjcxN30.aWZmDHAV6dnN-K8GGddNNgO77KDv2PKlGO9lmAI8K5I	\N	\N	2026-06-21 20:08:37.411	f	2026-05-22 20:08:37.411474
0da89aa7-91ec-485f-a7fa-91470671195f	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk0NjA4MjYsImV4cCI6MTc4MjA1MjgyNn0.l6V53KCUNwH-mDUuo_UVtCT4dRb_-UllBxdywX8VkMc	\N	\N	2026-06-21 20:10:26.19	f	2026-05-22 20:10:26.191095
a735876a-4724-46bd-83ea-4f1593fbfce5	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk0NjA4MzIsImV4cCI6MTc4MjA1MjgzMn0.98yqbGUXfW7-IrHyQzXB0W_Ehk-9hwuvIMl_1bAGWrE	\N	\N	2026-06-21 20:10:32.516	f	2026-05-22 20:10:32.516787
352eb3aa-e59c-4464-8ad1-d0d771f36eb8	d263eb62-0c0f-458b-bf31-654549c58655	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJkMjYzZWI2Mi0wYzBmLTQ1OGItYmYzMS02NTQ1NDljNTg2NTUiLCJpYXQiOjE3Nzk0NjA4NzMsImV4cCI6MTc4MjA1Mjg3M30.XJYX8-ypJZ17y7Mw8I8qZ2_EXxHPlW1gKz6UoO5b7-s	\N	\N	2026-06-21 20:11:13.936	f	2026-05-22 20:11:13.936753
05241001-f5e6-446b-ae67-f9eabbd4ebcb	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk0NjA5MTYsImV4cCI6MTc4MjA1MjkxNn0.FyHeroEoBnBsRrbzB5dBqdCsgLhUIVT2a6zHrlE7yvw	\N	\N	2026-06-21 20:11:56.048	f	2026-05-22 20:11:56.04893
536dd62b-9373-4a35-87ee-9dea0e31b4f9	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk0NjM1MTcsImV4cCI6MTc4MjA1NTUxN30.kTPRgk4iyeRW-JEwAxcUNguB-koKRKHYumBtOQ2EvMY	\N	\N	2026-06-21 20:55:17.571	t	2026-05-22 20:55:17.571658
11b9fde0-68e9-4341-9879-8f79488579f6	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk0NjA5MTksImV4cCI6MTc4MjA1MjkxOX0.ChtsKtSTA8Csjzcg_GJTKKGg1iLou-lVTvMWK-hFW3Q	\N	\N	2026-06-21 20:11:59.484	t	2026-05-22 20:11:59.484912
2c93d957-e233-4280-9ea0-ba623a602d8d	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk0NjIyNzYsImV4cCI6MTc4MjA1NDI3Nn0.5iLWMZMsXDfH8ScoTXDlO6kmJZwon2R7gL7FsqJqKdk	\N	\N	2026-06-21 20:34:36.041	f	2026-05-22 20:34:36.041516
33d3f63d-1d84-4afd-92db-ef97644a2971	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk0NjIyNzYsImV4cCI6MTc4MjA1NDI3Nn0.5iLWMZMsXDfH8ScoTXDlO6kmJZwon2R7gL7FsqJqKdk	\N	\N	2026-06-21 20:34:36.041	f	2026-05-22 20:34:36.042076
c3d8eb1f-72f1-468e-94bd-5f7f84e1365d	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk0NjIyNzYsImV4cCI6MTc4MjA1NDI3Nn0.5iLWMZMsXDfH8ScoTXDlO6kmJZwon2R7gL7FsqJqKdk	\N	\N	2026-06-21 20:34:36.042	f	2026-05-22 20:34:36.042493
f1a1ee26-1dcd-4213-8f98-30abe637e0e9	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk0NjIyNzYsImV4cCI6MTc4MjA1NDI3Nn0.5iLWMZMsXDfH8ScoTXDlO6kmJZwon2R7gL7FsqJqKdk	\N	\N	2026-06-21 20:34:36.04	t	2026-05-22 20:34:36.040714
e58e66a5-4c3f-4b7f-8f94-87bb301d0877	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk0NjM1MTcsImV4cCI6MTc4MjA1NTUxN30.kTPRgk4iyeRW-JEwAxcUNguB-koKRKHYumBtOQ2EvMY	\N	\N	2026-06-21 20:55:17.572	f	2026-05-22 20:55:17.572338
20b70ca9-6299-4fb3-8c34-b9928e075479	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk0NjM1MTcsImV4cCI6MTc4MjA1NTUxN30.kTPRgk4iyeRW-JEwAxcUNguB-koKRKHYumBtOQ2EvMY	\N	\N	2026-06-21 20:55:17.572	f	2026-05-22 20:55:17.57288
620ee800-2de3-4dc5-99ee-0d7eed994471	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk0NjM1MTcsImV4cCI6MTc4MjA1NTUxN30.kTPRgk4iyeRW-JEwAxcUNguB-koKRKHYumBtOQ2EvMY	\N	\N	2026-06-21 20:55:17.573	f	2026-05-22 20:55:17.573581
df134e0e-82e7-42ea-a4f9-96ed43179cd6	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk0NjQ1NDYsImV4cCI6MTc4MjA1NjU0Nn0.H_7LGuhqPKHit9iCmsnqY3Ch-g8PzP4xjFBd1fRQPVU	\N	\N	2026-06-21 21:12:26.245	f	2026-05-22 21:12:26.252189
a3cedc5e-095b-4b89-9cf2-959288fca56e	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk0NjQ1NDYsImV4cCI6MTc4MjA1NjU0Nn0.H_7LGuhqPKHit9iCmsnqY3Ch-g8PzP4xjFBd1fRQPVU	\N	\N	2026-06-21 21:12:26.247	f	2026-05-22 21:12:26.252252
967399dd-8ef2-4ce9-9c95-fcd5bdb9ecc5	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk0NjQ1NDYsImV4cCI6MTc4MjA1NjU0Nn0.H_7LGuhqPKHit9iCmsnqY3Ch-g8PzP4xjFBd1fRQPVU	\N	\N	2026-06-21 21:12:26.268	f	2026-05-22 21:12:26.274063
02b31bd9-1c8d-4c7c-bb58-7f9ba1fe0135	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk0NjYyMzksImV4cCI6MTc4MjA1ODIzOX0.9QmP4DqeRC0R4TF-yWMTg-04VF3GMQkcCugU10Cayxk	\N	\N	2026-06-21 21:40:39.986	t	2026-05-22 21:40:39.986784
c61f224d-a2aa-46f8-ac23-170973ce6a27	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk0NjQ1NDksImV4cCI6MTc4MjA1NjU0OX0.TU466-ixbjJnEKHDHLqdS6hwx-6W2GnahfWTtUDfuR0	\N	\N	2026-06-21 21:12:29.26	t	2026-05-22 21:12:29.26052
0f65deea-7867-4c87-ad6d-55de99b664e2	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk0NjU0NTcsImV4cCI6MTc4MjA1NzQ1N30.XEhHhJXO_q5ARYeVgIyFdlqrqrebzbHmief5vO2HI3w	\N	\N	2026-06-21 21:27:37.33	f	2026-05-22 21:27:37.331202
6c274bee-ace9-4c62-a5a1-7bce51f2b635	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk0NjU0NTcsImV4cCI6MTc4MjA1NzQ1N30.XEhHhJXO_q5ARYeVgIyFdlqrqrebzbHmief5vO2HI3w	\N	\N	2026-06-21 21:27:37.334	f	2026-05-22 21:27:37.334905
5a1720c0-3604-4c0a-915a-70f7fe69b93a	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk0NjU0NTcsImV4cCI6MTc4MjA1NzQ1N30.XEhHhJXO_q5ARYeVgIyFdlqrqrebzbHmief5vO2HI3w	\N	\N	2026-06-21 21:27:37.336	f	2026-05-22 21:27:37.336134
715d2796-fba9-48a5-a90e-8813cd8d6e3b	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk0NjU0ODksImV4cCI6MTc4MjA1NzQ4OX0.NRfLC7rmNPKDh5R-o5j-tabmmObceZPtBnyKsHKUAek	\N	\N	2026-06-21 21:28:09.127	f	2026-05-22 21:28:09.128044
4d51840b-44f8-4a05-978d-fb9b428fa494	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk0NjU0OTgsImV4cCI6MTc4MjA1NzQ5OH0.IhodYHmTvqL_gWDRvIIvW6HbAz1q1jYXaj6U3OULxFs	\N	\N	2026-06-21 21:28:18.682	f	2026-05-22 21:28:18.683188
1e8933d4-b149-4b7c-9b3b-0a963d34eff6	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk0NjU1MDcsImV4cCI6MTc4MjA1NzUwN30.snU0lLE0j4o6FMI3ZCyM5fWmQFDFROEYVnL0W2LPIEM	\N	\N	2026-06-21 21:28:27.172	f	2026-05-22 21:28:27.172718
a0d7b783-36ae-4cec-b793-f5412c77d741	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk0NjU1MDksImV4cCI6MTc4MjA1NzUwOX0.1m_2O-Yd8IqPNMaer5WEKgyvtJEPhImCC-q2adqejCo	\N	\N	2026-06-21 21:28:29.102	f	2026-05-22 21:28:29.102324
b294099a-4769-4222-976c-71b37b3de09e	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk0NjU1MTAsImV4cCI6MTc4MjA1NzUxMH0.wnTJ86MxjUYaxNmab_LG-_Ax8SUwFcm7S_mfKvBPY48	\N	\N	2026-06-21 21:28:30.868	f	2026-05-22 21:28:30.868865
6a1b4444-5524-42b8-baa6-0bf3445e75d4	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk0NjU1MTIsImV4cCI6MTc4MjA1NzUxMn0.8So6JirbkwA8ObcorThyv-VTZGHQWyuY_0JM3OC0goM	\N	\N	2026-06-21 21:28:32.475	f	2026-05-22 21:28:32.475886
6f0f233a-10d5-40eb-8290-54d6cc6e42cc	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk0NjU1MTQsImV4cCI6MTc4MjA1NzUxNH0.U9C8ZlD59IyRw4gYEGCrhLRbZQH0XK24Tsrt9u9g9CU	\N	\N	2026-06-21 21:28:34.16	f	2026-05-22 21:28:34.161503
0b61e52c-d0b3-414a-bbdc-ad94cce3d1a8	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk0NjU5OTEsImV4cCI6MTc4MjA1Nzk5MX0.TZWdrYTl-TkU7IFDJE1eNtHrhqTat6zmrgUBq8M_SHQ	\N	\N	2026-06-21 21:36:31.336	f	2026-05-22 21:36:31.336947
b6d0c532-6458-4efd-88ca-043f9da1fd83	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk0NjYwNjksImV4cCI6MTc4MjA1ODA2OX0.psBweY55hnBTY4L3z1onjA8KBU0BOuN328HCUVkSHKA	\N	\N	2026-06-21 21:37:49.359	f	2026-05-22 21:37:49.359824
238f3feb-7028-4c81-9fac-d9819fef0040	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk0NjYwODYsImV4cCI6MTc4MjA1ODA4Nn0.JTMTI2f5EELpmIJkGX_5iKPTyaHYqWK-hIz0D3NuRfI	\N	\N	2026-06-21 21:38:06.641	f	2026-05-22 21:38:06.641424
8460a4f6-2bdb-47ce-ace7-c27e5e1c0335	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk0NjYwODksImV4cCI6MTc4MjA1ODA4OX0.f4xb42COLF9GbTv-ksVydrMBx7gAndwF_szMwu0OUAM	\N	\N	2026-06-21 21:38:09.265	f	2026-05-22 21:38:09.265532
5e96ff32-f33d-4544-925f-5dcf1384432a	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk0NjYxODEsImV4cCI6MTc4MjA1ODE4MX0.X6AQzPqeZcBS8XZg22Z4kf9Sqs6TcEEd0UKjiTJ7L44	\N	\N	2026-06-21 21:39:41.738	f	2026-05-22 21:39:41.738961
430abe4c-244f-4961-8f09-ce53b7e6ccd4	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk0NzExMDYsImV4cCI6MTc4MjA2MzEwNn0.nrK03F6_4bJjPv8stKhHgG31NNMGqZUXxI1kZC8sip0	\N	\N	2026-06-21 23:01:46.119	f	2026-05-22 23:01:46.119778
4810ece8-7fc3-4b6a-a3b0-fb4347913d3c	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk0NzExMDYsImV4cCI6MTc4MjA2MzEwNn0.nrK03F6_4bJjPv8stKhHgG31NNMGqZUXxI1kZC8sip0	\N	\N	2026-06-21 23:01:46.12	f	2026-05-22 23:01:46.120304
66ac3ba1-2edb-425e-a23d-1474e85dd151	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk0NzExMDYsImV4cCI6MTc4MjA2MzEwNn0.nrK03F6_4bJjPv8stKhHgG31NNMGqZUXxI1kZC8sip0	\N	\N	2026-06-21 23:01:46.12	f	2026-05-22 23:01:46.120769
ee88dbcc-7e2f-4109-bf59-463f659be30c	d263eb62-0c0f-458b-bf31-654549c58655	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJkMjYzZWI2Mi0wYzBmLTQ1OGItYmYzMS02NTQ1NDljNTg2NTUiLCJpYXQiOjE3Nzk1MjcyODUsImV4cCI6MTc4MjExOTI4NX0.0NHUDirQjEf32T6Js09t9UHGrydrfXZ843AL8oRbk48	\N	\N	2026-06-22 14:38:05.143	f	2026-05-23 14:38:05.143619
a67a810b-c17f-4927-9247-56f4d51f813e	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk1MjM2NTMsImV4cCI6MTc4MjExNTY1M30.xqwvAkwdvbpIWvBmqNoe8eLz9SosXXJcUwOoaVoqzw4	\N	\N	2026-06-22 13:37:33.555	t	2026-05-23 13:37:33.556158
05f63482-5f0d-49d9-9ca6-bd94fe603fc1	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk0NzExMzAsImV4cCI6MTc4MjA2MzEzMH0.c74dm_WwkP89QalVn-O_faxAYlfxOTsMfhHuKKtX1gU	\N	\N	2026-06-21 23:02:10.015	t	2026-05-22 23:02:10.016161
fe5ba099-6216-4055-a4b1-7765b3702557	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk1MTM0NjAsImV4cCI6MTc4MjEwNTQ2MH0.jaUalwMI-G17XPXS0FpWFFXDqxw-ifxYJUaE7NaBq4U	\N	\N	2026-06-22 10:47:40.574	f	2026-05-23 10:47:40.574954
ca61b121-0f66-441a-aeab-e833b275c47a	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk1MTM0NjAsImV4cCI6MTc4MjEwNTQ2MH0.jaUalwMI-G17XPXS0FpWFFXDqxw-ifxYJUaE7NaBq4U	\N	\N	2026-06-22 10:47:40.575	f	2026-05-23 10:47:40.575566
203148c7-133d-4d8d-ac9d-e2599d968dd8	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk1MTM0NjAsImV4cCI6MTc4MjEwNTQ2MH0.jaUalwMI-G17XPXS0FpWFFXDqxw-ifxYJUaE7NaBq4U	\N	\N	2026-06-22 10:47:40.575	f	2026-05-23 10:47:40.576103
cd8fb407-e584-427b-8442-094317483689	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk1MTM0NjAsImV4cCI6MTc4MjEwNTQ2MH0.jaUalwMI-G17XPXS0FpWFFXDqxw-ifxYJUaE7NaBq4U	\N	\N	2026-06-22 10:47:40.576	f	2026-05-23 10:47:40.576642
164f6ed2-ae32-492f-9152-48b4d088fc25	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk1MTM0NjgsImV4cCI6MTc4MjEwNTQ2OH0.31lp96Vzf1U0Yn8xCEtk3K_5re-dfdTetLHaohjiVgw	\N	\N	2026-06-22 10:47:48.957	f	2026-05-23 10:47:48.957946
0ff2369c-8896-4fc1-9e36-6c80f38752c5	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk1MTM0NzIsImV4cCI6MTc4MjEwNTQ3Mn0.RNmi78vxbz51F1n4QKBsP6wZn3QL5_2vYh8ohE48R6s	\N	\N	2026-06-22 10:47:52.748	f	2026-05-23 10:47:52.749105
11407b38-1df1-43d3-86c0-6132511fb005	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk1MTM3ODYsImV4cCI6MTc4MjEwNTc4Nn0.sNj42rtreiDTX6wM5Kc9_izeaBJq-t8q7CVioh8VDK8	\N	\N	2026-06-22 10:53:06.441	f	2026-05-23 10:53:06.441453
5bcb1c81-e7a9-4072-a35c-70eecff09824	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk1MTM3OTMsImV4cCI6MTc4MjEwNTc5M30.uLH8WRdF3FKqOpg7oYPs88llU37RY94oAMwxuGf7WTk	\N	\N	2026-06-22 10:53:13.496	f	2026-05-23 10:53:13.497633
833fd5b6-0f0b-40b4-810b-9144afe77505	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk1MjUzNzksImV4cCI6MTc4MjExNzM3OX0.MAyMkrriYWFgHOvTSGUeeFumk6gS05D4YxDW_fhGRU8	\N	\N	2026-06-22 14:06:19.131	f	2026-05-23 14:06:19.132092
84c8bbc3-f631-4eba-9991-ba4d90c65c47	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk1MjUzNzksImV4cCI6MTc4MjExNzM3OX0.MAyMkrriYWFgHOvTSGUeeFumk6gS05D4YxDW_fhGRU8	\N	\N	2026-06-22 14:06:19.131	t	2026-05-23 14:06:19.131368
9a66c78d-68fa-4c98-a75c-a05d701b7251	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk1MjYyODAsImV4cCI6MTc4MjExODI4MH0.8PMzbW8T5ikhQysEREOkaE4hjyEd-dNAVpRmhUz5Fb4	\N	\N	2026-06-22 14:21:20.342	f	2026-05-23 14:21:20.342453
b1913eb3-c300-4eee-a853-a418cc5902e8	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk1MTUxODksImV4cCI6MTc4MjEwNzE4OX0.gEz-FVmt1LotvpOCTnOHGbVe9gn5syhYCyeOyYQQ8rQ	\N	\N	2026-06-22 11:16:29.861	t	2026-05-23 11:16:29.862238
87020090-64ef-4d59-b14f-63625444616d	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk1MjMyNDgsImV4cCI6MTc4MjExNTI0OH0.OpV8gNJwcrBAet339BqcN6Uo67-fCvRKkCFLoqez3_M	\N	\N	2026-06-22 13:30:48.23	f	2026-05-23 13:30:48.230984
365691dc-2e46-44ba-973d-f271c9d84169	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk1MjMyNDgsImV4cCI6MTc4MjExNTI0OH0.OpV8gNJwcrBAet339BqcN6Uo67-fCvRKkCFLoqez3_M	\N	\N	2026-06-22 13:30:48.231	f	2026-05-23 13:30:48.23152
dafde472-dcc1-46c9-b9ff-279ecdbab1f2	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk1MjMyNDgsImV4cCI6MTc4MjExNTI0OH0.OpV8gNJwcrBAet339BqcN6Uo67-fCvRKkCFLoqez3_M	\N	\N	2026-06-22 13:30:48.231	f	2026-05-23 13:30:48.232057
db6d6fc5-f1e3-4682-a8b2-4131cfd4d930	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk1MjMyNDgsImV4cCI6MTc4MjExNTI0OH0.OpV8gNJwcrBAet339BqcN6Uo67-fCvRKkCFLoqez3_M	\N	\N	2026-06-22 13:30:48.232	f	2026-05-23 13:30:48.232701
46af3e1d-74d2-4892-a18b-f74105b72673	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk1MjMyNTYsImV4cCI6MTc4MjExNTI1Nn0.O7RwaJHWG0E-cgbMrlqSCcBxQ73hRTsdoaDY1s4hfy4	\N	\N	2026-06-22 13:30:56.32	f	2026-05-23 13:30:56.320674
ad85f543-4a4c-42fa-8e09-073ed977acaa	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk1MjMzMDcsImV4cCI6MTc4MjExNTMwN30.J2WQD_zMLDjvQfyXeCKIWw6EwJwn-GRewtM3VTHjjdA	\N	\N	2026-06-22 13:31:47.714	f	2026-05-23 13:31:47.714419
add0da55-9ec8-4f4c-86e3-81c0a0a105cd	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk1MjYyOTksImV4cCI6MTc4MjExODI5OX0.7nE-U2CoetfhikXWGZ4kre-ES0wSxuzEwmbrpPpMQBQ	\N	\N	2026-06-22 14:21:39.758	f	2026-05-23 14:21:39.758838
bd59aff9-20aa-4e69-80b5-b62268c0c678	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3Nzk1MjcyODYsImV4cCI6MTc4MjExOTI4Nn0.iPlIaO7RufHz-LqfVe2qdFWF2iIVAk51kmINhVXDiU4	\N	\N	2026-06-22 14:38:06.853	f	2026-05-23 14:38:06.854146
6d6d6927-0145-461f-b858-0ac2a1d0f4bd	d263eb62-0c0f-458b-bf31-654549c58655	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJkMjYzZWI2Mi0wYzBmLTQ1OGItYmYzMS02NTQ1NDljNTg2NTUiLCJpYXQiOjE3Nzk1MjYzNjUsImV4cCI6MTc4MjExODM2NX0.Wg1U5dDQi5FmVNabJepPz4WAnRT-NkKciJAwyBTnxhY	\N	\N	2026-06-22 14:22:45.589	t	2026-05-23 14:22:45.589897
bcd45d5c-2cd2-4644-a117-202a35c4a6c8	d263eb62-0c0f-458b-bf31-654549c58655	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJkMjYzZWI2Mi0wYzBmLTQ1OGItYmYzMS02NTQ1NDljNTg2NTUiLCJpYXQiOjE3Nzk1MjcyODUsImV4cCI6MTc4MjExOTI4NX0.0NHUDirQjEf32T6Js09t9UHGrydrfXZ843AL8oRbk48	\N	\N	2026-06-22 14:38:05.144	f	2026-05-23 14:38:05.145105
631b795a-a739-4abd-8839-ad79aca904fb	d263eb62-0c0f-458b-bf31-654549c58655	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJkMjYzZWI2Mi0wYzBmLTQ1OGItYmYzMS02NTQ1NDljNTg2NTUiLCJpYXQiOjE3Nzk1MjcyODUsImV4cCI6MTc4MjExOTI4NX0.0NHUDirQjEf32T6Js09t9UHGrydrfXZ843AL8oRbk48	\N	\N	2026-06-22 14:38:05.145	f	2026-05-23 14:38:05.145906
be308f86-e9f8-4207-806d-6415a1135cdd	d263eb62-0c0f-458b-bf31-654549c58655	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJkMjYzZWI2Mi0wYzBmLTQ1OGItYmYzMS02NTQ1NDljNTg2NTUiLCJpYXQiOjE3Nzk1MjcyOTksImV4cCI6MTc4MjExOTI5OX0.VJnnD2hIrtW-kEwSHm9wZNRJqF2BcbEXiTuSuB88Oic	\N	\N	2026-06-22 14:38:19.614	f	2026-05-23 14:38:19.614845
6652e355-c4a6-4828-815e-27397f979fa1	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3Nzk1MjgxOTYsImV4cCI6MTc4MjEyMDE5Nn0.xOJe7-ccLkaSXs5lKXV4IK7IuBHgTKRc5wVYj31JIaA	\N	\N	2026-06-22 14:53:16.373	f	2026-05-23 14:53:16.373673
58bccf41-1882-4bd1-af62-6e72181fd2e2	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk1NDE2OTAsImV4cCI6MTc4MjEzMzY5MH0.18pciA2Ezu4o_kj3_On7hkW17qydZOPbgBrltoTTK8I	\N	\N	2026-06-22 18:38:10.569	t	2026-05-23 18:38:10.569732
1bffbff9-05c4-453b-b5d5-5e1a4edf6169	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk1MjgyMDUsImV4cCI6MTc4MjEyMDIwNX0.xCzml1hZQVeB4_qD6sEtCDg9Ozi_B-SV6vXcVr2IzGs	\N	\N	2026-06-22 14:53:25.726	t	2026-05-23 14:53:25.726941
3437e651-6748-4001-9866-ac79c1a484c2	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk1MjkxNTYsImV4cCI6MTc4MjEyMTE1Nn0.CeLAxhKb3r4oZSsdsQC7SKDXXFexNshWokJfyGgYipc	\N	\N	2026-06-22 15:09:16.886	f	2026-05-23 15:09:16.886603
88328193-e316-474e-a1ef-04e297a7240f	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk1MjkxNTYsImV4cCI6MTc4MjEyMTE1Nn0.CeLAxhKb3r4oZSsdsQC7SKDXXFexNshWokJfyGgYipc	\N	\N	2026-06-22 15:09:16.888	f	2026-05-23 15:09:16.888576
ee2ff345-2050-4463-8e4d-f411a59533b7	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk1MjkxNTYsImV4cCI6MTc4MjEyMTE1Nn0.CeLAxhKb3r4oZSsdsQC7SKDXXFexNshWokJfyGgYipc	\N	\N	2026-06-22 15:09:16.889	f	2026-05-23 15:09:16.889461
8b03cb7c-c4e1-4f7d-a6ff-c1b7b9e723cb	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk1NDA2MTgsImV4cCI6MTc4MjEzMjYxOH0.gepSjrSm1ASU5RPxmRU4gL5hvdPVcyjWuJND2qf9C8E	\N	\N	2026-06-22 18:20:18.463	t	2026-05-23 18:20:18.464118
3f07fc30-ae28-4c40-a399-623bc6c9588a	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk1NDE2OTAsImV4cCI6MTc4MjEzMzY5MH0.18pciA2Ezu4o_kj3_On7hkW17qydZOPbgBrltoTTK8I	\N	\N	2026-06-22 18:38:10.57	f	2026-05-23 18:38:10.570335
baa3ab22-23cb-43fc-9430-6ba402543a13	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk1MjkxNTYsImV4cCI6MTc4MjEyMTE1Nn0.CeLAxhKb3r4oZSsdsQC7SKDXXFexNshWokJfyGgYipc	\N	\N	2026-06-22 15:09:16.885	t	2026-05-23 15:09:16.885907
d2594b16-e746-4a12-ad0a-973400a0c6ce	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk1MzAxNjAsImV4cCI6MTc4MjEyMjE2MH0.rQwC9UMMKYiEzCGZ5VGPInmLXhCb_zkWWyiLnFU1VMo	\N	\N	2026-06-22 15:26:00.43	f	2026-05-23 15:26:00.430668
0d22b652-2e1b-4dd8-8514-12ae7d3a88d9	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk1MzAxNjAsImV4cCI6MTc4MjEyMjE2MH0.rQwC9UMMKYiEzCGZ5VGPInmLXhCb_zkWWyiLnFU1VMo	\N	\N	2026-06-22 15:26:00.431	f	2026-05-23 15:26:00.431432
38ab5d31-71f4-479e-b1b1-35f9d33cd4bf	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk1MzAxNjAsImV4cCI6MTc4MjEyMjE2MH0.rQwC9UMMKYiEzCGZ5VGPInmLXhCb_zkWWyiLnFU1VMo	\N	\N	2026-06-22 15:26:00.431	f	2026-05-23 15:26:00.43195
b04ca3c6-4c8d-4aec-8817-7a124e4aebc6	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk1MzAxNjAsImV4cCI6MTc4MjEyMjE2MH0.rQwC9UMMKYiEzCGZ5VGPInmLXhCb_zkWWyiLnFU1VMo	\N	\N	2026-06-22 15:26:00.433	f	2026-05-23 15:26:00.433288
ab8c5158-da76-4950-b7ae-8f47f9b9ae23	d263eb62-0c0f-458b-bf31-654549c58655	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJkMjYzZWI2Mi0wYzBmLTQ1OGItYmYzMS02NTQ1NDljNTg2NTUiLCJpYXQiOjE3Nzk1MzA4ODAsImV4cCI6MTc4MjEyMjg4MH0.lCx-z8HXoBZX0nYcPB_EBkxQcbHO4RV5k8leI5ESvQM	\N	\N	2026-06-22 15:38:00.078	f	2026-05-23 15:38:00.078739
0ebdb399-ea9b-457e-9f2c-5352cd30d7de	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk1MzA5NzEsImV4cCI6MTc4MjEyMjk3MX0.tvk6n_3kYOHc4D3swUSEn805wCDZVzvLij_DAbuw-Ok	\N	\N	2026-06-22 15:39:31.619	f	2026-05-23 15:39:31.619404
72d7584e-b1cc-45ac-b2f3-5e4e14618dc3	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk1MzA5NzUsImV4cCI6MTc4MjEyMjk3NX0.I_VqMHG6E_mFGdgZ5DfZLkOmV0tEmGa6SrAoHTftfHw	\N	\N	2026-06-22 15:39:35.931	f	2026-05-23 15:39:35.931777
dcabda86-8205-4528-b6b8-cc7e770e8cc2	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk1MzA5ODksImV4cCI6MTc4MjEyMjk4OX0.w1GSgDYbLXH_KT-G_INIHyGCDjKfhiAdnFz6T1BYsXg	\N	\N	2026-06-22 15:39:49.356	f	2026-05-23 15:39:49.356671
53600dd0-1416-4f29-bb4a-e9fd029d2965	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3Nzk1MzExMzEsImV4cCI6MTc4MjEyMzEzMX0.8QiwKw5gi70XbyrxC1673Dn4sIpDEHaUUW7-qPf0FJk	\N	\N	2026-06-22 15:42:11.428	f	2026-05-23 15:42:11.428826
c4b7777f-31cf-45de-878a-7d01f7fa7db7	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk1MzEyNDcsImV4cCI6MTc4MjEyMzI0N30.kR701d8MpTFMDsPZTvjDiYjdLx4VmkEywY70T72PPq8	\N	\N	2026-06-22 15:44:07.128	f	2026-05-23 15:44:07.128607
32cafd88-17b4-4cc2-8773-1ea7b2d4dc0e	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk1NDA1NTYsImV4cCI6MTc4MjEzMjU1Nn0.0JMubVlQwspnr4xZosKMM3nHqCZzbyER8yOeXZ64Nxk	\N	\N	2026-06-22 18:19:16.909	f	2026-05-23 18:19:16.90991
8c8e3955-2ff9-470d-89d2-06b12bb0271f	d263eb62-0c0f-458b-bf31-654549c58655	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJkMjYzZWI2Mi0wYzBmLTQ1OGItYmYzMS02NTQ1NDljNTg2NTUiLCJpYXQiOjE3Nzk1NDA1ODMsImV4cCI6MTc4MjEzMjU4M30.wYkOU6SQKIwBBpTev0NmTHIIdrl3c-KOzXTbvqsbiYo	\N	\N	2026-06-22 18:19:43.351	f	2026-05-23 18:19:43.35121
29f75483-59e9-4fca-8316-a0bb288ffb59	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk1NDE2OTAsImV4cCI6MTc4MjEzMzY5MH0.18pciA2Ezu4o_kj3_On7hkW17qydZOPbgBrltoTTK8I	\N	\N	2026-06-22 18:38:10.57	f	2026-05-23 18:38:10.570739
5f21c7e5-937f-433b-96b8-48e49224d051	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk1NDE2OTAsImV4cCI6MTc4MjEzMzY5MH0.18pciA2Ezu4o_kj3_On7hkW17qydZOPbgBrltoTTK8I	\N	\N	2026-06-22 18:38:10.571	f	2026-05-23 18:38:10.571164
fad3e2af-5c11-45a4-a619-20a4804c4fc0	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk1NDI2MDIsImV4cCI6MTc4MjEzNDYwMn0.jHFzpxPTDmw2ZtI3xv6ENqe_0ZG3dzJlMrJsvfUZ2zU	\N	\N	2026-06-22 18:53:22.35	f	2026-05-23 18:53:22.350693
a3fb29b2-1049-4f72-be08-26dbce477382	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk1NDI2MDIsImV4cCI6MTc4MjEzNDYwMn0.jHFzpxPTDmw2ZtI3xv6ENqe_0ZG3dzJlMrJsvfUZ2zU	\N	\N	2026-06-22 18:53:22.349	t	2026-05-23 18:53:22.350044
dc6adf24-e507-44ff-b259-edf26ecff8b4	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk1NDM3NTIsImV4cCI6MTc4MjEzNTc1Mn0.Cee_FMc77iscZqxiFxQFD12pNE9iqa8xCNZCWrZQzEw	\N	\N	2026-06-22 19:12:32.254	f	2026-05-23 19:12:32.254377
c0b8898d-d27c-4382-adff-f259f1863563	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk1NDM3NTIsImV4cCI6MTc4MjEzNTc1Mn0.Cee_FMc77iscZqxiFxQFD12pNE9iqa8xCNZCWrZQzEw	\N	\N	2026-06-22 19:12:32.254	f	2026-05-23 19:12:32.254989
a63e8943-59ef-4a03-9809-53004ee480b7	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk1NDM3NTIsImV4cCI6MTc4MjEzNTc1Mn0.Cee_FMc77iscZqxiFxQFD12pNE9iqa8xCNZCWrZQzEw	\N	\N	2026-06-22 19:12:32.255	f	2026-05-23 19:12:32.255549
8f9b2475-af57-42f5-9d05-ad9f748c47f3	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk1NDM3NTIsImV4cCI6MTc4MjEzNTc1Mn0.Cee_FMc77iscZqxiFxQFD12pNE9iqa8xCNZCWrZQzEw	\N	\N	2026-06-22 19:12:32.255	f	2026-05-23 19:12:32.256051
75e18ae4-5e17-4d45-a106-b7acb4f2aa11	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk1NDQwMzEsImV4cCI6MTc4MjEzNjAzMX0.DT1xxHTihuJsBT3pYERGdgZajvykvaxGJlQRjtqf9iI	\N	\N	2026-06-22 19:17:11.907	f	2026-05-23 19:17:11.907388
ba816563-56c9-4d91-bd08-60f4d3b03c35	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk1NDQ0MjAsImV4cCI6MTc4MjEzNjQyMH0.fkeQ4NugrtTlUD0f4Eany_8x5__vhbwmsuPjOMAIVKg	\N	\N	2026-06-22 19:23:40.82	f	2026-05-23 19:23:40.820755
48b8ff94-5534-493e-bb85-ca018b89311b	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk1NDQ1MTIsImV4cCI6MTc4MjEzNjUxMn0.7owj7vGDGYFxjOcpBi0qSULFG_LW0ltgGwD_F8Xnvi0	\N	\N	2026-06-22 19:25:12.557	f	2026-05-23 19:25:12.557725
02a707ff-1433-48f9-b69b-62e09d928b4c	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk1NDQ1MTksImV4cCI6MTc4MjEzNjUxOX0.ILgNbmbHVKk0IQz7S5Q_H732t-SuvRdUrw2qBUpbxQY	\N	\N	2026-06-22 19:25:19.735	f	2026-05-23 19:25:19.736114
4484ca59-63ef-4918-b96f-41ff2566f2c5	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk1NDQ2MDcsImV4cCI6MTc4MjEzNjYwN30.JoWSdefOTSJsMpFpWf0Z5mKmCTwrGaBcRgfJWDoR6Do	\N	\N	2026-06-22 19:26:47.64	f	2026-05-23 19:26:47.641085
af3f4e76-da02-42d7-96b8-cc4df2e6d14a	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk1NDQ2MTIsImV4cCI6MTc4MjEzNjYxMn0.X22LQCc2mCNCMwxGsAJmSnRGdYOA8bjqyxVbLdxsU1c	\N	\N	2026-06-22 19:26:52.221	f	2026-05-23 19:26:52.222152
02ea494c-e0f2-4f4c-828d-6ea9e9ecec2a	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk1NDQ2MTQsImV4cCI6MTc4MjEzNjYxNH0._bbzJec0O8ltobdg-IJHDrrXHNpgvIE3B8OWPgJlTmI	\N	\N	2026-06-22 19:26:54.011	f	2026-05-23 19:26:54.011874
6430565d-0393-4f4a-83bf-70aed131afed	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk1NDQ2MTUsImV4cCI6MTc4MjEzNjYxNX0.CkD0_mODRxsBL0geRt3PH4jM5TQxunFmwr2rqYk3Yq4	\N	\N	2026-06-22 19:26:55.808	f	2026-05-23 19:26:55.809283
aff17109-cd26-4657-a310-f070b4275e8a	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk1NDQ2MTgsImV4cCI6MTc4MjEzNjYxOH0.TxU7hsWsOVzZdVbEPFJon431kAe8PrMZBDj5bv14vLE	\N	\N	2026-06-22 19:26:58.236	f	2026-05-23 19:26:58.236335
a46fb1da-029b-4650-80f5-4fad4a1eb104	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk1NDQ2MjAsImV4cCI6MTc4MjEzNjYyMH0.JGyMDkm16dvo7vgAUVajAESeRXcz77tzcrqX4O6ftsg	\N	\N	2026-06-22 19:27:00.555	f	2026-05-23 19:27:00.555348
9ffecd3b-db8f-4da0-8e79-5f32702f6ca9	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk1NDQ2MjIsImV4cCI6MTc4MjEzNjYyMn0.pQ6eHUBpLzAu7BdIoE0I9TBjgmhAs78g6ezkJW4x-VU	\N	\N	2026-06-22 19:27:02.192	f	2026-05-23 19:27:02.192975
813e832a-a7cb-495b-9e0e-6b49e421448a	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk1NDQ2MjQsImV4cCI6MTc4MjEzNjYyNH0.HsJlYTkRAUCeSXgfouQJoVk7cZSTdoSSCWvAPf3C1nY	\N	\N	2026-06-22 19:27:04.115	f	2026-05-23 19:27:04.115614
c141dea5-a2fe-4919-bd00-c17c37daf110	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk1NDQ2MjYsImV4cCI6MTc4MjEzNjYyNn0.O4ZzBV8yBfR2KjGP4kvsXDn1mr3TZSXYPN6pc7iXq3Q	\N	\N	2026-06-22 19:27:06.121	f	2026-05-23 19:27:06.121882
a9a06df6-6c5d-496d-95a2-cbc6a20fcb05	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk1NDQ2MjcsImV4cCI6MTc4MjEzNjYyN30.5ehEZ7aXc7OF7ld-NOEblQlH9B49eb0tcAQ47NOOS7g	\N	\N	2026-06-22 19:27:07.524	f	2026-05-23 19:27:07.524668
2446f8de-c5a2-4193-90e4-fc2ead7bf6a7	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk1NDQ2MzYsImV4cCI6MTc4MjEzNjYzNn0.Y0j1dDO01is82BHb-lBsRDu8k0-gCy7ZvDaghlaOBf0	\N	\N	2026-06-22 19:27:16.946	f	2026-05-23 19:27:16.947329
ed04f729-2f8a-4d29-9e83-54fbea354690	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk1NDQ2NDAsImV4cCI6MTc4MjEzNjY0MH0.gIEOszSCaltI2p-UCs86vS3IR1__1KuI0k2sVJDE9Ls	\N	\N	2026-06-22 19:27:20.154	f	2026-05-23 19:27:20.155254
cac9bef4-de2c-4bf6-ab82-f2e2b995392c	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk1NDQ2NzYsImV4cCI6MTc4MjEzNjY3Nn0.mWXHZR50MisdTNoxd_nmLQCM2zEuTA8iBQMntNEogio	\N	\N	2026-06-22 19:27:56.588	f	2026-05-23 19:27:56.58858
b48dde2e-4a9c-476e-9fcb-d330ebe54b3b	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk1NDQ2ODMsImV4cCI6MTc4MjEzNjY4M30.FyBQWWuUwvA8HxifKk7ekQ1TgPncyynnS17GQ2U8f7c	\N	\N	2026-06-22 19:28:03.111	f	2026-05-23 19:28:03.111328
bcde479e-9fcd-4ce1-ac2e-2616537f32e4	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk1NDQ2OTUsImV4cCI6MTc4MjEzNjY5NX0.Ejufc1Ms1SiHCBO7tLSfKlusg0-xaI2NEcZIvm3QQTg	\N	\N	2026-06-22 19:28:15.163	f	2026-05-23 19:28:15.163883
33aa76cd-ec97-42b5-a159-163a226cdf4c	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk1NDQ3NTYsImV4cCI6MTc4MjEzNjc1Nn0.Gn5Ce0Sp4d2D7Zufmj9-M0lT8wQ8FJ7x7Iq-q8I2rII	\N	\N	2026-06-22 19:29:16.353	f	2026-05-23 19:29:16.353556
bc89e8da-33d2-4dbe-8463-997e007d99db	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3Nzk1NDQ3ODAsImV4cCI6MTc4MjEzNjc4MH0.LuJHqVV7WKMKzEWO9AwUfft_BGwuy2j6zEX8i67gqNs	\N	\N	2026-06-22 19:29:40.795	f	2026-05-23 19:29:40.795921
2459be07-8f14-4e2d-9350-3e48862d7b10	d263eb62-0c0f-458b-bf31-654549c58655	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJkMjYzZWI2Mi0wYzBmLTQ1OGItYmYzMS02NTQ1NDljNTg2NTUiLCJpYXQiOjE3Nzk1NDQ3OTIsImV4cCI6MTc4MjEzNjc5Mn0.gmGRJfrwzQ1_Iwjh88wfqtakuT5K7DyiYBbvsgmPPSU	\N	\N	2026-06-22 19:29:52.026	f	2026-05-23 19:29:52.026539
2fe98e13-02c4-4360-8305-2a333f8de1ee	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk1NDQ5NDksImV4cCI6MTc4MjEzNjk0OX0.Dc1eo0n1dpK06OwUuxkpufHOsZE7jOJ5KWHFzriK2E0	\N	\N	2026-06-22 19:32:29.62	f	2026-05-23 19:32:29.620604
379bb544-9596-4c25-9c1f-22bbcbe2da63	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk1NDUwMTcsImV4cCI6MTc4MjEzNzAxN30.OPPQy9fyx1H3LsV56piBhu3aPSIHuZ3vwM4P_hvjIjE	\N	\N	2026-06-22 19:33:37.41	f	2026-05-23 19:33:37.41067
a8fdd6cc-c0ee-4a7a-bb69-5dee613c0446	d263eb62-0c0f-458b-bf31-654549c58655	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJkMjYzZWI2Mi0wYzBmLTQ1OGItYmYzMS02NTQ1NDljNTg2NTUiLCJpYXQiOjE3Nzk1NDUwMzMsImV4cCI6MTc4MjEzNzAzM30.Y-biBVEv_yUx_B_SOvCqNmaQ08J-DRbA04ZE_vTERnQ	\N	\N	2026-06-22 19:33:53.176	f	2026-05-23 19:33:53.176268
2ac689ce-8774-4245-b84b-e0da70f329cd	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk1NDUwNTUsImV4cCI6MTc4MjEzNzA1NX0.80GFSmX4lzF7AVJruskHrwno4K8RFbLMsbHtnzbDq7U	\N	\N	2026-06-22 19:34:15.118	f	2026-05-23 19:34:15.118894
a44d2259-d903-41d2-80be-2cea06385e6e	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk1NDU4MjgsImV4cCI6MTc4MjEzNzgyOH0.aVRo9ntWd5kGIX3RUO9jV7LLR8HZ3DG8FZgrjitmBDw	\N	\N	2026-06-22 19:47:08.972	t	2026-05-23 19:47:08.972535
3c3eaa9c-757b-4965-bc58-3029b458a957	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk1NDY3NDcsImV4cCI6MTc4MjEzODc0N30.kxkKpcCODtviqO7mYI2p8wDctI2VHAFvwQz1mgko_ko	\N	\N	2026-06-22 20:02:27.107	f	2026-05-23 20:02:27.107856
8bca118f-f2b6-4635-980a-a2c6bc7c5099	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk1NDY3NDcsImV4cCI6MTc4MjEzODc0N30.kxkKpcCODtviqO7mYI2p8wDctI2VHAFvwQz1mgko_ko	\N	\N	2026-06-22 20:02:27.108	f	2026-05-23 20:02:27.109171
077ca3b8-3c29-4a9c-8df4-5b7b04731d71	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk1NDY3NDgsImV4cCI6MTc4MjEzODc0OH0.uiWaP5zk8aMtDejLH75Ox9SBXQXxVYPESxSvjjYtH_0	\N	\N	2026-06-22 20:02:28.84	f	2026-05-23 20:02:28.840802
ed56d9f4-6d0c-4d3e-9ce9-7c882e2b2c24	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk1NDY5ODUsImV4cCI6MTc4MjEzODk4NX0.z2LagiWvERSn7y8WXPN4ur1RR_GerbBsTyfG2VsHs78	\N	\N	2026-06-22 20:06:25.991	f	2026-05-23 20:06:25.991323
45de3753-1e9b-4f04-9ef9-07db72bfeca9	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk1NDc3NjUsImV4cCI6MTc4MjEzOTc2NX0.hpVDzQrR7B6XPfvshzIIDfXZm0Wy1UytcRM_bwAVjXk	\N	\N	2026-06-22 20:19:25.255	f	2026-05-23 20:19:25.255384
23ac86a9-1074-4892-b20e-b188f02157de	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk1ODI4NjIsImV4cCI6MTc4MjE3NDg2Mn0.Njrew5Y287QuQKNJGdDRMpjqykQVqL1-OqtptvhKjV0	\N	\N	2026-06-23 06:04:22.244	f	2026-05-24 06:04:22.244936
4043c841-5e21-4ad5-84be-e5a9a4c30225	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk1ODI5MjEsImV4cCI6MTc4MjE3NDkyMX0.FrrgqTP9cqwOU9C5xRk217cXMIAaWnBiYyOc8TuVLLg	\N	\N	2026-06-23 06:05:21.071	f	2026-05-24 06:05:21.072067
6c9547e8-7187-42ff-a118-eb49cf172c14	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk1ODMwMzEsImV4cCI6MTc4MjE3NTAzMX0.ALZ-Pe4g0O7mh6YQ4aOGpb5Kg24jFzF8-GN2tsLIVLo	\N	\N	2026-06-23 06:07:11.495	f	2026-05-24 06:07:11.495358
0bb6297e-c234-4c7b-b70b-dd06fe21ea5b	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk1ODMwNDAsImV4cCI6MTc4MjE3NTA0MH0.eSI-23NsoBRHW-Wv2bS5E4ctNA3G-x7nRBffr8wHhQ0	\N	\N	2026-06-23 06:07:20.909	f	2026-05-24 06:07:20.909775
632c84c1-2cae-4c93-8981-17f59b735d0a	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk1ODMwNTcsImV4cCI6MTc4MjE3NTA1N30.nM8vyIFJMrpMKGwSOyViPC35E1yWVMAFXFdTNuOL2fA	\N	\N	2026-06-23 06:07:37.655	f	2026-05-24 06:07:37.655375
f88e43a6-c6d8-4c4c-8476-35ce33e167ac	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk1ODMxODMsImV4cCI6MTc4MjE3NTE4M30.A1NQLhvG5BvFzz9b-ifQj7Ix0qTNyy5sJEsPxjso7N0	\N	\N	2026-06-23 06:09:43.428	f	2026-05-24 06:09:43.428326
6b8d17db-6035-4586-b698-76c95b00b9a2	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3Nzk1ODMxOTcsImV4cCI6MTc4MjE3NTE5N30.J4mO_ndJLRwWL9CIXTwEm6TMmlVX089-XFG_Bt7M18g	\N	\N	2026-06-23 06:09:57.709	f	2026-05-24 06:09:57.709626
42d8f32d-0dd7-4c75-b2b9-ec52ec5fb23c	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk1ODM0MzEsImV4cCI6MTc4MjE3NTQzMX0.wwCfxjLD3vr-NL-lItHfybonnb1CI2IuMlt_3_emkQc	\N	\N	2026-06-23 06:13:51.126	f	2026-05-24 06:13:51.126952
bf9d417a-f6e1-48a8-b674-10d317f9ae48	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk1ODM0NDAsImV4cCI6MTc4MjE3NTQ0MH0.WmmDR3Uxh5B6SaDG3L2Eqq6FHOLU0PqWxrbsy_db9w8	\N	\N	2026-06-23 06:14:00.428	f	2026-05-24 06:14:00.428193
0528611d-f302-46b3-80d1-45d07bfa599f	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk1ODM0NzksImV4cCI6MTc4MjE3NTQ3OX0.jTL8jCkfAlL_APXx94l7_mA69D8_VbqqkNiuVoBeS1Q	\N	\N	2026-06-23 06:14:39.051	f	2026-05-24 06:14:39.051669
aeeb30ac-0745-47dd-af45-24fa390c26a6	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk1ODM1MTYsImV4cCI6MTc4MjE3NTUxNn0.BesNI3guLZ9x7ziJ20koR_JoEL9aY03O1ju3iM3oqMs	\N	\N	2026-06-23 06:15:16.575	f	2026-05-24 06:15:16.575793
26195e34-6ac7-44a3-930d-c7696093b671	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk2MDQ3NTMsImV4cCI6MTc4MjE5Njc1M30.zIcYauOd9B6fWJ91fQJBuGD0FVLw0cWeY-9JFV2RcmA	\N	\N	2026-06-23 12:09:13.976	t	2026-05-24 12:09:13.976899
cd597642-faa4-4862-bea8-6dfbad543cd2	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk1ODMyOTYsImV4cCI6MTc4MjE3NTI5Nn0.EOYvEl3pTTFuwoCOkRPlXmqXBuiSA4l2NpoZ6R0PROs	\N	\N	2026-06-23 06:11:36.691	t	2026-05-24 06:11:36.691464
62616419-d7cc-4744-a739-e83bb30a9ef5	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk2MDQ3NTMsImV4cCI6MTc4MjE5Njc1M30.zIcYauOd9B6fWJ91fQJBuGD0FVLw0cWeY-9JFV2RcmA	\N	\N	2026-06-23 12:09:13.976	f	2026-05-24 12:09:13.976335
d103d7c7-7234-4c52-9ba6-866591ffe026	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk2MDQ3NTMsImV4cCI6MTc4MjE5Njc1M30.zIcYauOd9B6fWJ91fQJBuGD0FVLw0cWeY-9JFV2RcmA	\N	\N	2026-06-23 12:09:13.977	f	2026-05-24 12:09:13.977563
28cae3f6-4ec8-4613-8837-7f2577b4288f	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk2MDQ3NTMsImV4cCI6MTc4MjE5Njc1M30.zIcYauOd9B6fWJ91fQJBuGD0FVLw0cWeY-9JFV2RcmA	\N	\N	2026-06-23 12:09:13.978	f	2026-05-24 12:09:13.978317
414cce63-c42b-4192-85e5-0d79d33f3027	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk2MDU2NTMsImV4cCI6MTc4MjE5NzY1M30.s2MsgwjckWmU1FcNuK9JRDkFlsmEg3clnp2LrfuSm8E	\N	\N	2026-06-23 12:24:13.061	f	2026-05-24 12:24:13.061486
e5715a81-8569-4f9f-bce8-3c407dbb0a10	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk2MDU2NTMsImV4cCI6MTc4MjE5NzY1M30.s2MsgwjckWmU1FcNuK9JRDkFlsmEg3clnp2LrfuSm8E	\N	\N	2026-06-23 12:24:13.062	f	2026-05-24 12:24:13.062561
2eec7b2e-6fae-43d9-8942-9df88403fb56	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk2MDU2NTMsImV4cCI6MTc4MjE5NzY1M30.s2MsgwjckWmU1FcNuK9JRDkFlsmEg3clnp2LrfuSm8E	\N	\N	2026-06-23 12:24:13.063	f	2026-05-24 12:24:13.063612
1f2c0468-33c1-41bb-b588-427b809e643d	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk2MDU2NTMsImV4cCI6MTc4MjE5NzY1M30.s2MsgwjckWmU1FcNuK9JRDkFlsmEg3clnp2LrfuSm8E	\N	\N	2026-06-23 12:24:13.064	f	2026-05-24 12:24:13.064551
b9fb6230-5043-411b-b8b4-eb4938f8d977	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3Nzk2MDU3MjYsImV4cCI6MTc4MjE5NzcyNn0.S2Mo3e4H43K4m2QIN_d7AG4YvFG7VAVlbCdkcfRcihE	\N	\N	2026-06-23 12:25:26.52	f	2026-05-24 12:25:26.520216
50919d92-2efb-47f8-a8d3-a29853b88066	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk2MDU5OTksImV4cCI6MTc4MjE5Nzk5OX0.1JOMAnKlsV74z8lhOzsB-2YCo5TXjmpn3NZTIC5BCIY	\N	\N	2026-06-23 12:29:59.987	f	2026-05-24 12:29:59.98761
082d4124-0322-4923-8c37-00c5ef9a85de	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk2MDYxMjYsImV4cCI6MTc4MjE5ODEyNn0.m6izAM6DSEFpkNin4OkuCLJwcH1SMf_7WAM3glH5kJ8	\N	\N	2026-06-23 12:32:06.027	f	2026-05-24 12:32:06.027769
661554b7-d91c-4fa9-9ac3-c69402c59837	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk2MDcwMTMsImV4cCI6MTc4MjE5OTAxM30.Yqdu8CGbS69ZsF8wvGd4erQMD60qeZU3W1DbmumGYRs	\N	\N	2026-06-23 12:46:53.896	f	2026-05-24 12:46:53.897023
ddaa96de-2f23-419b-9e4b-9355c096f4bb	d263eb62-0c0f-458b-bf31-654549c58655	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJkMjYzZWI2Mi0wYzBmLTQ1OGItYmYzMS02NTQ1NDljNTg2NTUiLCJpYXQiOjE3Nzk2MDcxMjEsImV4cCI6MTc4MjE5OTEyMX0.akCzf_Qc2Hu2Dm6-3bWzi-QjBYDW10G9Aar92C7Isos	\N	\N	2026-06-23 12:48:41.253	f	2026-05-24 12:48:41.253822
57c9cf6d-e963-4032-985b-c3c56176ccdb	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3Nzk2MDcyNDIsImV4cCI6MTc4MjE5OTI0Mn0.Q-AcVDYlJtBd3ZUvXMWzeqnAi-NCX0pegsneJC2rdKo	\N	\N	2026-06-23 12:50:42.857	f	2026-05-24 12:50:42.857197
38d38b4a-b065-42e9-8f5f-cf33d58a627f	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk2MDc1OTMsImV4cCI6MTc4MjE5OTU5M30.dLxYFMbN0jbZMWPOpU7EpzUxR0c-NMad_Jld-kPAcMI	\N	\N	2026-06-23 12:56:33.73	t	2026-05-24 12:56:33.730269
f6b25b46-cb2c-4f3c-8825-242105e4c602	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk2MjI5NDMsImV4cCI6MTc4MjIxNDk0M30.EIy_wov-ZFwZkixOXV1TG6qNHiB4P6hkQ9ddxN4ixmc	\N	\N	2026-06-23 17:12:23.823	f	2026-05-24 17:12:23.824192
ac27aaab-7971-4887-b30a-a27fa7b48016	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk2MjI5NDgsImV4cCI6MTc4MjIxNDk0OH0.wyIwtJedy9PD_CH_V_0W6ZwW_SNzC4VCKe6NDHENIYw	\N	\N	2026-06-23 17:12:28.832	t	2026-05-24 17:12:28.832447
2a2978c1-2439-455c-8b2c-303719f28fd8	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk2MjM5NzUsImV4cCI6MTc4MjIxNTk3NX0.1VQVqJCfHMYjbYWmsbVgu-HnsIWoxO1POfY0BNj8De0	\N	\N	2026-06-23 17:29:35.584	f	2026-05-24 17:29:35.584496
65ba0f80-e8a8-4209-baa7-42062f836ce8	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3Nzk2MjQwNzgsImV4cCI6MTc4MjIxNjA3OH0.5cbOxopZmoqhkX4qz80lx0-dtkr3vZ4escapKZXJ9wA	\N	\N	2026-06-23 17:31:18.37	f	2026-05-24 17:31:18.370612
f2dc5576-352d-4741-ae3a-7278c2eff93a	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk2MjQwODEsImV4cCI6MTc4MjIxNjA4MX0.vHFxCFV8U9cI_88In5Io-Fdwy5whkHo4AAP-tsw5OF0	\N	\N	2026-06-23 17:31:21.88	f	2026-05-24 17:31:21.880254
f0829e94-4f89-4ad6-8263-88908e874cbe	d263eb62-0c0f-458b-bf31-654549c58655	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJkMjYzZWI2Mi0wYzBmLTQ1OGItYmYzMS02NTQ1NDljNTg2NTUiLCJpYXQiOjE3Nzk2MjQxOTMsImV4cCI6MTc4MjIxNjE5M30.f9pP1YvzBpd7bv5GgMmo3fEKRThbfYbc5qNZinrwiBU	\N	\N	2026-06-23 17:33:13.705	f	2026-05-24 17:33:13.705649
d83d56b6-1e96-4f1a-9888-99b4156d1609	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk2MjQzODIsImV4cCI6MTc4MjIxNjM4Mn0.wqyu9rZz65C4c17jghHrGxAm9WeTbVFLkr0he9i7WBM	\N	\N	2026-06-23 17:36:22.581	f	2026-05-24 17:36:22.581454
b9ceed21-5d6a-4e57-aa82-0cd30a5acfa0	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk2MjQ3MTAsImV4cCI6MTc4MjIxNjcxMH0.-NKSRqJgQoW51TkIJweT6A2rFTjh0VkA4I2pJlOgWCg	\N	\N	2026-06-23 17:41:50.383	f	2026-05-24 17:41:50.383458
7db10bf0-e6f7-4e6d-99ae-559ef3b05797	d263eb62-0c0f-458b-bf31-654549c58655	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJkMjYzZWI2Mi0wYzBmLTQ1OGItYmYzMS02NTQ1NDljNTg2NTUiLCJpYXQiOjE3Nzk2MjQ3MjEsImV4cCI6MTc4MjIxNjcyMX0.DYn-pekMgqAN6TMF5FgZ1wbjIIJspqK9xM3lFZnmoB8	\N	\N	2026-06-23 17:42:01.584	f	2026-05-24 17:42:01.58514
f5243a75-f5d0-4948-a1ad-a53a6c5d5060	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk2MzQ3NjQsImV4cCI6MTc4MjIyNjc2NH0.xG8FQMNLNWGsH9rQRREonNdKjSd6hrCIbh9pDEPW6XQ	\N	\N	2026-06-23 20:29:24.237	f	2026-05-24 20:29:24.23798
d5d794bd-4376-49bf-8e53-60ca0b1e7aea	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk2MjQ4NDUsImV4cCI6MTc4MjIxNjg0NX0.CGpxIsb1OW_2cAy7XGjX7Rz79eBbD0p95m76dcCPvyU	\N	\N	2026-06-23 17:44:05.925	t	2026-05-24 17:44:05.926159
988ac8c1-86b3-41f6-83ae-c626b8c14090	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk2MzQ3NjQsImV4cCI6MTc4MjIyNjc2NH0.xG8FQMNLNWGsH9rQRREonNdKjSd6hrCIbh9pDEPW6XQ	\N	\N	2026-06-23 20:29:24.238	f	2026-05-24 20:29:24.239086
e587094c-e98c-41bf-96c2-b4892ca460c4	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk2MzQ3NjcsImV4cCI6MTc4MjIyNjc2N30.Bi0Pew-LRPHAe8tzz2lkR3VCMqz_yM5jbUnsUJB5mhw	\N	\N	2026-06-23 20:29:27.603	f	2026-05-24 20:29:27.603984
1a606d2f-7905-4d9b-86c9-0f7fb1baf14f	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk2MzUyOTksImV4cCI6MTc4MjIyNzI5OX0.8iEM1UBDcDCd-we_YnHsGtHQ0ufKzpYE2lJ1hJH21ko	\N	\N	2026-06-23 20:38:19.611	f	2026-05-24 20:38:19.611588
ed10015a-7022-4c85-b2ac-b5dc6b87b6b9	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3Nzk2MzY5MDUsImV4cCI6MTc4MjIyODkwNX0._RhUr0hCvD7vino8RkdciSSlS4qq4l8iIFikf8YJm7s	\N	\N	2026-06-23 21:05:05.77	f	2026-05-24 21:05:05.770449
aacdadfb-2005-4029-a14d-5f27d31ce4a4	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk2NjkwMTIsImV4cCI6MTc4MjI2MTAxMn0.aPouMlXbPofm6sGynmbTkoWOx9ydqRJvHFcNt60GuEs	\N	\N	2026-06-24 06:00:12.945	f	2026-05-25 06:00:12.945527
1e0c3a27-6af0-4aa4-958e-e05675628ed0	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk2NjkyMjUsImV4cCI6MTc4MjI2MTIyNX0.GT55WNhRzw5lrXL4MIwZjGQ4Evv3AbGODF43_B-ja5k	\N	\N	2026-06-24 06:03:45.228	f	2026-05-25 06:03:45.229095
0542a2e1-7dc7-4f61-af90-44e9fc26b1db	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk2NjkyODIsImV4cCI6MTc4MjI2MTI4Mn0.OHrmLy4GgYXrsEF-SwbgdBOSuuyEH5rwHIfXAq-gyRo	\N	\N	2026-06-24 06:04:42.339	f	2026-05-25 06:04:42.33959
55911fbe-1d38-4c1f-b1b6-4c686d5f7c06	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk2NjkzMjgsImV4cCI6MTc4MjI2MTMyOH0.rEI8Cb4M4D8iVCnb2OnS3HdLeu37IGZd1IvC2ODPiEY	\N	\N	2026-06-24 06:05:28.123	f	2026-05-25 06:05:28.123655
392db2f7-08fe-4861-a67c-69538201c0fa	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk2NjkzOTQsImV4cCI6MTc4MjI2MTM5NH0.w5vEHgA2VyfCwjBSwIEv0Qhm_I4Qwu1OEhAW6Rx1hXU	\N	\N	2026-06-24 06:06:34.575	f	2026-05-25 06:06:34.575396
2de32068-1ab0-42e3-9f78-e48a19ffdc6e	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk2NzA4OTIsImV4cCI6MTc4MjI2Mjg5Mn0.e91b8cpM52VDE45qm4cTlseY6K81BJWwzISuNqUaYV4	\N	\N	2026-06-24 06:31:32.016	f	2026-05-25 06:31:32.016462
ff691d04-012f-4efa-bdd1-5493754b9a9e	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk1MTYwMjIsImV4cCI6MTc4MjEwODAyMn0.WfPDco2mdUHmwPBoxXbGCgQsal--ukfeV1H5wn3llVw	\N	\N	2026-06-22 11:30:22.213	t	2026-05-23 11:30:22.214272
195e10ea-c2c0-4020-99a5-bc79bc828c77	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk2Njk0NTcsImV4cCI6MTc4MjI2MTQ1N30.oeHwNFhL55qit2h0WnaX_kyrfalQAA9bfSxx4h0Wmyk	\N	\N	2026-06-24 06:07:37.838	f	2026-05-25 06:07:37.83826
478bca67-8857-4f1b-ba95-4286dcf9074e	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk2Njk0NTcsImV4cCI6MTc4MjI2MTQ1N30.oeHwNFhL55qit2h0WnaX_kyrfalQAA9bfSxx4h0Wmyk	\N	\N	2026-06-24 06:07:37.838	f	2026-05-25 06:07:37.838794
57b689ee-5fc3-42c0-87c2-44a33db0653e	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk2Njk0NTcsImV4cCI6MTc4MjI2MTQ1N30.oeHwNFhL55qit2h0WnaX_kyrfalQAA9bfSxx4h0Wmyk	\N	\N	2026-06-24 06:07:37.839	f	2026-05-25 06:07:37.839237
29c32001-c847-4b4f-8477-b2ef22b15d95	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk2Njk4ODYsImV4cCI6MTc4MjI2MTg4Nn0.IMZhjbgnt9pDFI63HqG6zUoJKpZCcM_82G-ofN6gEQQ	\N	\N	2026-06-24 06:14:46.157	f	2026-05-25 06:14:46.158299
5ae59c7e-2d19-4be7-9889-043a6ac77429	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk2Njk4OTgsImV4cCI6MTc4MjI2MTg5OH0.5cEjOt8eRCqefghRxDFZcOjRyvXbSYoYPfJaX1DYtRs	\N	\N	2026-06-24 06:14:58.609	t	2026-05-25 06:14:58.609368
c9d75ed0-1b20-49d0-8457-64663b6de822	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk2Njk4OTgsImV4cCI6MTc4MjI2MTg5OH0.5cEjOt8eRCqefghRxDFZcOjRyvXbSYoYPfJaX1DYtRs	\N	\N	2026-06-24 06:14:58.829	f	2026-05-25 06:14:58.829594
8547c433-ba64-4372-b4d6-933d3b51edf0	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk2Njk4OTgsImV4cCI6MTc4MjI2MTg5OH0.5cEjOt8eRCqefghRxDFZcOjRyvXbSYoYPfJaX1DYtRs	\N	\N	2026-06-24 06:14:58.94	f	2026-05-25 06:14:58.941106
241b5312-a9c4-4efd-bc30-133e0b064abe	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk2NzEyNzIsImV4cCI6MTc4MjI2MzI3Mn0.5SEtCiYiCLGSVoE7jL-qQiiv96Q9qK0mEbRO8-EOTkE	\N	\N	2026-06-24 06:37:52.431	f	2026-05-25 06:37:52.43124
4a5cb2e0-0a9c-4c18-a97d-90850923f351	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk2NzEzMTYsImV4cCI6MTc4MjI2MzMxNn0.b4FBeYwU1VM8Bwb0ZcVN8ShWX3YfH4S-ISbeZgNHrE4	\N	\N	2026-06-24 06:38:36.208	f	2026-05-25 06:38:36.209146
de5d99bb-fcda-453f-b670-25a9429fa6d7	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk2NzEzMzMsImV4cCI6MTc4MjI2MzMzM30.7i3XQnCODtqMxeyOLgU3xyV2-LOvIZes-wNBxTTyP_s	\N	\N	2026-06-24 06:38:53.144	f	2026-05-25 06:38:53.144329
e3b38855-d6b1-4409-bcb5-5e700ac810ab	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk2Njk0NjAsImV4cCI6MTc4MjI2MTQ2MH0.Tr5SsiH6M1OExKlqBi68mAtUQ5gBBsXEBDfpnx3CFpo	\N	\N	2026-06-24 06:07:40.322	t	2026-05-25 06:07:40.322585
dff66e23-8c5e-4b94-941f-bff8b7280b34	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk2NzA3ODMsImV4cCI6MTc4MjI2Mjc4M30.h_OHOlVMeFEXafPNJBUgOCP9rBF9xGzhVCGKr5Hjhlw	\N	\N	2026-06-24 06:29:43.494	f	2026-05-25 06:29:43.494917
2f8eb228-8cd8-40b0-9b08-2ac4b3ed820a	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk2NzA3ODMsImV4cCI6MTc4MjI2Mjc4M30.h_OHOlVMeFEXafPNJBUgOCP9rBF9xGzhVCGKr5Hjhlw	\N	\N	2026-06-24 06:29:43.495	f	2026-05-25 06:29:43.495675
f4967ad3-1eb8-475e-8023-d9984cda22c8	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk2NzA3ODMsImV4cCI6MTc4MjI2Mjc4M30.h_OHOlVMeFEXafPNJBUgOCP9rBF9xGzhVCGKr5Hjhlw	\N	\N	2026-06-24 06:29:43.496	f	2026-05-25 06:29:43.496256
b339066a-aa81-46d1-984c-08577d1a5c64	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk2NzA3ODMsImV4cCI6MTc4MjI2Mjc4M30.h_OHOlVMeFEXafPNJBUgOCP9rBF9xGzhVCGKr5Hjhlw	\N	\N	2026-06-24 06:29:43.498	f	2026-05-25 06:29:43.498408
73cd3408-1afa-4180-8021-66668dd34dae	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk2ODc1MTcsImV4cCI6MTc4MjI3OTUxN30.Hu_BjD-FzAs_KqUnwuVWy_LkTVaigrlb1-_sEJ5J-K0	\N	\N	2026-06-24 11:08:37.036	f	2026-05-25 11:08:37.036507
389cdbd5-1e8f-4e84-9544-116af92774b5	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk2ODc1ODAsImV4cCI6MTc4MjI3OTU4MH0.UQNWjfxM0pLEYhsfB9M_5PcZbC1y650sNqMD4RbR6K8	\N	\N	2026-06-24 11:09:40.921	f	2026-05-25 11:09:40.921937
58986b7a-b051-46cc-9622-d4d5ebdc5097	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk2ODc2MTYsImV4cCI6MTc4MjI3OTYxNn0.JyD_dPmYFsiaayRXdQl4ROGJjDC8TuWzI3aOxM4Q3VA	\N	\N	2026-06-24 11:10:16.972	f	2026-05-25 11:10:16.972331
0a26af2f-0787-4b91-bf76-c216bf4f810b	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk2ODc2OTcsImV4cCI6MTc4MjI3OTY5N30.Zi8JRNdMOSSM8OEWVSN_ynHWkdOnUpnUeJRDAkQus4g	\N	\N	2026-06-24 11:11:37.746	f	2026-05-25 11:11:37.747084
f1ce68bc-0b0d-420a-a9e1-5a645a7a972d	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk2ODk4NzEsImV4cCI6MTc4MjI4MTg3MX0.nluBWW2HlkobaW6H1k99w-ZhLAh4H1TPzrro6xiaJY4	\N	\N	2026-06-24 11:47:51.309	t	2026-05-25 11:47:51.30976
03fcb5fa-7f24-4151-bb90-fa7d5b3287c6	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk2OTU3OTEsImV4cCI6MTc4MjI4Nzc5MX0.nUp7wqtzbyVVdP8QyHDGb0imJOOMJCVAM325WdKn1yI	\N	\N	2026-06-24 13:26:31.021	f	2026-05-25 13:26:31.021241
6d77ef19-3453-472c-a7ee-82b4ddca7536	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk2OTU3OTEsImV4cCI6MTc4MjI4Nzc5MX0.nUp7wqtzbyVVdP8QyHDGb0imJOOMJCVAM325WdKn1yI	\N	\N	2026-06-24 13:26:31.021	f	2026-05-25 13:26:31.021721
c7c2aa09-d379-4ea1-959a-637b0104b24c	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk2OTY0NDEsImV4cCI6MTc4MjI4ODQ0MX0.o2bahgHnCp3mG3JPjkq4ku6OqV8xc1SKx9z1rMN0pI0	\N	\N	2026-06-24 13:37:21.703	f	2026-05-25 13:37:21.703403
be25113d-ee20-4e3b-95a4-9683d83f52a8	c2fd6bc5-5766-4eba-b691-0438f77e3d33	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjMmZkNmJjNS01NzY2LTRlYmEtYjY5MS0wNDM4Zjc3ZTNkMzMiLCJpYXQiOjE3Nzk2OTg0NDcsImV4cCI6MTc4MjI5MDQ0N30._uX2kJ9V1vCH08g62p7jqlHfQHwjqqkr9HLy5l5o9NY	\N	\N	2026-06-24 14:10:47.245	f	2026-05-25 14:10:47.245442
f800695a-c710-42f6-b07d-064b0889bd46	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk3MTM3MDAsImV4cCI6MTc4MjMwNTcwMH0.les8WWHM_HfFQQ1nFwyTaIBPlYnMeb6lmMf6lRyqKLg	\N	\N	2026-06-24 18:25:00.743	f	2026-05-25 18:25:00.743686
a2547dc2-276c-431c-9541-82a9b67ceedd	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk3MTQ3MjgsImV4cCI6MTc4MjMwNjcyOH0.snD8yzTBb7Y5hNSXoIUabOyKVqEdytexIZVNAXB9l10	\N	\N	2026-06-24 18:42:08.48	f	2026-05-25 18:42:08.480267
faddf816-fa2d-4679-86ae-0c82a2a9e478	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk3MTQ3MzUsImV4cCI6MTc4MjMwNjczNX0.Tgw__OXhvQAxefqVwNmD9Q5TUCn3Fdwv59DiGxTXi1o	\N	\N	2026-06-24 18:42:15.404	f	2026-05-25 18:42:15.404957
7ad280c4-4c74-4baf-b5ab-d0dc99664470	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk3MTQ3MzcsImV4cCI6MTc4MjMwNjczN30.w-ZGybvYNIwVd4LZCFD0u0djhU9u6ZNO972PhXmYlek	\N	\N	2026-06-24 18:42:17.47	f	2026-05-25 18:42:17.470507
8220c5fe-508d-42fe-941a-4c0d66ecaadf	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk3MTQ3MzksImV4cCI6MTc4MjMwNjczOX0.6vAKoybCWDuAOYDbyfGmoT3wCXn4psaE6wVUGh0eQWU	\N	\N	2026-06-24 18:42:19.239	f	2026-05-25 18:42:19.240833
769c2efa-749f-4295-aefe-3d12128088c8	c2fd6bc5-5766-4eba-b691-0438f77e3d33	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjMmZkNmJjNS01NzY2LTRlYmEtYjY5MS0wNDM4Zjc3ZTNkMzMiLCJpYXQiOjE3Nzk3MjU5ODAsImV4cCI6MTc4MjMxNzk4MH0.ufk-_U8oytLlT7JgTfIXuGELhWR7iL4kuznIQCiNfNM	\N	\N	2026-06-24 21:49:40.794	f	2026-05-25 21:49:40.794531
cd61755a-a77f-4045-8da9-dc2dc306259d	c2fd6bc5-5766-4eba-b691-0438f77e3d33	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjMmZkNmJjNS01NzY2LTRlYmEtYjY5MS0wNDM4Zjc3ZTNkMzMiLCJpYXQiOjE3Nzk3MjU5ODQsImV4cCI6MTc4MjMxNzk4NH0.PfqkM6bK4jfeaVz1gxrC8B2IJ2XoMzAQjb2UeqtdNB4	\N	\N	2026-06-24 21:49:44.024	f	2026-05-25 21:49:44.025175
1b00d6a7-3fc1-457d-b81e-03f52f9b8a41	c2fd6bc5-5766-4eba-b691-0438f77e3d33	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjMmZkNmJjNS01NzY2LTRlYmEtYjY5MS0wNDM4Zjc3ZTNkMzMiLCJpYXQiOjE3Nzk3MjU5ODUsImV4cCI6MTc4MjMxNzk4NX0.p60M9Yu_72GfcNTqHtvpKA_88ED-9DoIVtw_jTXDlSo	\N	\N	2026-06-24 21:49:45.777	f	2026-05-25 21:49:45.777579
bb50d4f5-121a-434c-8bd0-43ce2df5fb74	c2fd6bc5-5766-4eba-b691-0438f77e3d33	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjMmZkNmJjNS01NzY2LTRlYmEtYjY5MS0wNDM4Zjc3ZTNkMzMiLCJpYXQiOjE3Nzk3MjU5OTEsImV4cCI6MTc4MjMxNzk5MX0._JwwXeX_-STfbGiOAjmfI-3WAd12i5O5Ca4nRy9hemU	\N	\N	2026-06-24 21:49:51.536	f	2026-05-25 21:49:51.536816
b552e208-f0ac-4566-a8c2-216397c79ccb	c2fd6bc5-5766-4eba-b691-0438f77e3d33	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjMmZkNmJjNS01NzY2LTRlYmEtYjY5MS0wNDM4Zjc3ZTNkMzMiLCJpYXQiOjE3Nzk3MjU5OTMsImV4cCI6MTc4MjMxNzk5M30.rmSBFrwQb0_V1NO2fPWQrg4mJBy8LMag4lQ09e975jA	\N	\N	2026-06-24 21:49:53.633	f	2026-05-25 21:49:53.633558
3988c054-a8a2-4230-9aa8-061f36587c59	c2fd6bc5-5766-4eba-b691-0438f77e3d33	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjMmZkNmJjNS01NzY2LTRlYmEtYjY5MS0wNDM4Zjc3ZTNkMzMiLCJpYXQiOjE3Nzk3MjYwMDUsImV4cCI6MTc4MjMxODAwNX0.weylXokrnql7l_F_9nMHBBYPXpTT20x_8cVITpaqRRU	\N	\N	2026-06-24 21:50:05.629	f	2026-05-25 21:50:05.629837
e5c642b8-ceaf-4438-9472-b898396d491d	c2fd6bc5-5766-4eba-b691-0438f77e3d33	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjMmZkNmJjNS01NzY2LTRlYmEtYjY5MS0wNDM4Zjc3ZTNkMzMiLCJpYXQiOjE3Nzk3MjYwMDcsImV4cCI6MTc4MjMxODAwN30.vQx8GHnpdYxUYFVAMxFvkNYXhoo00eJNflxDQ4aBqNI	\N	\N	2026-06-24 21:50:07.184	f	2026-05-25 21:50:07.184791
8d5d8391-4c1e-4fc4-9184-012149419a32	c2fd6bc5-5766-4eba-b691-0438f77e3d33	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjMmZkNmJjNS01NzY2LTRlYmEtYjY5MS0wNDM4Zjc3ZTNkMzMiLCJpYXQiOjE3Nzk3MjYwMTQsImV4cCI6MTc4MjMxODAxNH0.5VeHv0NYJS2PnLppNA6GSU_VIUNq6n1vnEMO_WUxuMM	\N	\N	2026-06-24 21:50:14.481	f	2026-05-25 21:50:14.481899
3f13e3c5-2ce8-4f03-b6ff-8d538ac70c72	c2fd6bc5-5766-4eba-b691-0438f77e3d33	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjMmZkNmJjNS01NzY2LTRlYmEtYjY5MS0wNDM4Zjc3ZTNkMzMiLCJpYXQiOjE3Nzk3MjYwMjAsImV4cCI6MTc4MjMxODAyMH0.hTv4HZhTN0ekwRE5BTqsoStTARtiJYqwBvFrQZ7HpGs	\N	\N	2026-06-24 21:50:20.904	f	2026-05-25 21:50:20.904816
0bcd1ecc-3142-4587-b5e8-ec693280e1d9	70d9527d-011a-4548-ab1b-77a9c050e2dd	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI3MGQ5NTI3ZC0wMTFhLTQ1NDgtYWIxYi03N2E5YzA1MGUyZGQiLCJpYXQiOjE3Nzk3MjYyMzIsImV4cCI6MTc4MjMxODIzMn0.hBrURZGdqjBFPTHhYSgxLPpqsF5zAtyWhGPPYVS-BUo	\N	\N	2026-06-24 21:53:52.813	f	2026-05-25 21:53:52.813943
c6b93c26-4836-4cf6-af2d-eac12e7686f6	70d9527d-011a-4548-ab1b-77a9c050e2dd	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI3MGQ5NTI3ZC0wMTFhLTQ1NDgtYWIxYi03N2E5YzA1MGUyZGQiLCJpYXQiOjE3Nzk3MjYyNDMsImV4cCI6MTc4MjMxODI0M30.vBFh4FdB-AQrNlP-bD0NKOfp4tRmJm769RLP5b-Y7lI	\N	\N	2026-06-24 21:54:03.381	f	2026-05-25 21:54:03.38206
b5c8fc25-d6f8-42f4-9a6a-a4846df0e882	70d9527d-011a-4548-ab1b-77a9c050e2dd	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI3MGQ5NTI3ZC0wMTFhLTQ1NDgtYWIxYi03N2E5YzA1MGUyZGQiLCJpYXQiOjE3Nzk3MjYyOTIsImV4cCI6MTc4MjMxODI5Mn0.p53EFRAmAmYlU8ttdYmBW04RKH9AfE4LIPSDEUJNAjM	\N	\N	2026-06-24 21:54:52.844	f	2026-05-25 21:54:52.844263
d25e32ec-d5e3-4e66-bcaa-8a287b893e55	70d9527d-011a-4548-ab1b-77a9c050e2dd	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI3MGQ5NTI3ZC0wMTFhLTQ1NDgtYWIxYi03N2E5YzA1MGUyZGQiLCJpYXQiOjE3Nzk3MjYzMDEsImV4cCI6MTc4MjMxODMwMX0.QvGnzaGvMfuzHLLRmDKGh5jQaYu7D2XSTt8zQKM3vao	\N	\N	2026-06-24 21:55:01.684	f	2026-05-25 21:55:01.684896
8dad90e8-1107-497e-8f23-249ab1577d83	c2fd6bc5-5766-4eba-b691-0438f77e3d33	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjMmZkNmJjNS01NzY2LTRlYmEtYjY5MS0wNDM4Zjc3ZTNkMzMiLCJpYXQiOjE3Nzk3MjY0MzgsImV4cCI6MTc4MjMxODQzOH0.SpNn5h4ROcQ3SldJTQQWQm4x3Q7b2zZIhWWUjqH-js4	\N	\N	2026-06-24 21:57:18.635	f	2026-05-25 21:57:18.635513
b540582f-c5c8-4766-8ed1-bdea7d5d59c2	c2fd6bc5-5766-4eba-b691-0438f77e3d33	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjMmZkNmJjNS01NzY2LTRlYmEtYjY5MS0wNDM4Zjc3ZTNkMzMiLCJpYXQiOjE3Nzk3MjY0NDMsImV4cCI6MTc4MjMxODQ0M30.LfMnmHWQR1juB2j2XTM5gzb2j_7bs5Eq2VpaPc16hQk	\N	\N	2026-06-24 21:57:23.296	f	2026-05-25 21:57:23.297367
0fee238b-9494-488d-a36a-0b7933098fe7	c2fd6bc5-5766-4eba-b691-0438f77e3d33	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjMmZkNmJjNS01NzY2LTRlYmEtYjY5MS0wNDM4Zjc3ZTNkMzMiLCJpYXQiOjE3Nzk3MjY0NDgsImV4cCI6MTc4MjMxODQ0OH0.u2dh9DeJYNkuyzaNqOneHsa_RfhNOWLZ3s81vW9Rkn4	\N	\N	2026-06-24 21:57:28.548	f	2026-05-25 21:57:28.548737
a31b1824-23e7-4363-bc1f-a18a6a12cb3c	c2fd6bc5-5766-4eba-b691-0438f77e3d33	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjMmZkNmJjNS01NzY2LTRlYmEtYjY5MS0wNDM4Zjc3ZTNkMzMiLCJpYXQiOjE3Nzk3MjY0NTgsImV4cCI6MTc4MjMxODQ1OH0.8iPcM0gQ23VBX6W3El2lWjYlBH_vYGDGK7LsNuwYriY	\N	\N	2026-06-24 21:57:38.503	f	2026-05-25 21:57:38.504104
cec3e93b-98ad-4c91-acf9-34735b347ee4	c2fd6bc5-5766-4eba-b691-0438f77e3d33	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjMmZkNmJjNS01NzY2LTRlYmEtYjY5MS0wNDM4Zjc3ZTNkMzMiLCJpYXQiOjE3Nzk3MjY0NjIsImV4cCI6MTc4MjMxODQ2Mn0.IWrQPr_vnsGp15n9vIiGZAWJfpP4zdb-q9yAnbUpOVU	\N	\N	2026-06-24 21:57:42.949	f	2026-05-25 21:57:42.950157
2782d1ff-b7cd-4754-8f88-5aeff33819b3	c2fd6bc5-5766-4eba-b691-0438f77e3d33	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjMmZkNmJjNS01NzY2LTRlYmEtYjY5MS0wNDM4Zjc3ZTNkMzMiLCJpYXQiOjE3Nzk3MjY0NzcsImV4cCI6MTc4MjMxODQ3N30.Fo3YE2i-RhrId6oj4cl4MNRPn76a4ACgebj3AaFqrlI	\N	\N	2026-06-24 21:57:57.004	f	2026-05-25 21:57:57.005021
a3868a0b-f72f-4452-b9ef-5bfad5140ad6	c2fd6bc5-5766-4eba-b691-0438f77e3d33	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjMmZkNmJjNS01NzY2LTRlYmEtYjY5MS0wNDM4Zjc3ZTNkMzMiLCJpYXQiOjE3Nzk3MjY4MTEsImV4cCI6MTc4MjMxODgxMX0.ZXkMUVbqBRmMB69g1ZKyYX0LEvsF83E_alN-u5r42e0	\N	\N	2026-06-24 22:03:31.918	f	2026-05-25 22:03:31.919233
0a2fda79-6c98-4989-90c0-064ed013b9b0	c2fd6bc5-5766-4eba-b691-0438f77e3d33	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjMmZkNmJjNS01NzY2LTRlYmEtYjY5MS0wNDM4Zjc3ZTNkMzMiLCJpYXQiOjE3Nzk3MjY5ODAsImV4cCI6MTc4MjMxODk4MH0.OPVntim-H7gYK0a9ODxGGepdIjK374eBLPtXWNKD874	\N	\N	2026-06-24 22:06:20.841	f	2026-05-25 22:06:20.841241
d1e9cb64-9d42-40e7-b5fb-637e04d19eb1	c2fd6bc5-5766-4eba-b691-0438f77e3d33	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjMmZkNmJjNS01NzY2LTRlYmEtYjY5MS0wNDM4Zjc3ZTNkMzMiLCJpYXQiOjE3Nzk4MTY1MDMsImV4cCI6MTc4MjQwODUwM30.bUTZk-FQ4LEXmGBUGf-Y4p4gN_oqE3r1JvPz-PrRIvY	\N	\N	2026-06-25 22:58:23.417	f	2026-05-26 22:58:23.418173
654325cd-e5d4-41c4-9752-068128eaefdc	c2fd6bc5-5766-4eba-b691-0438f77e3d33	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjMmZkNmJjNS01NzY2LTRlYmEtYjY5MS0wNDM4Zjc3ZTNkMzMiLCJpYXQiOjE3Nzk4Mzk3NjYsImV4cCI6MTc4MjQzMTc2Nn0.oePeZCbb7c7urKX9PFz3dp4w-HwD9PFokR2C-qD4F8s	\N	\N	2026-06-26 05:26:06.453	f	2026-05-27 05:26:06.453956
ef354c4e-bbb2-4089-bdf4-b69107fd47f9	c2fd6bc5-5766-4eba-b691-0438f77e3d33	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjMmZkNmJjNS01NzY2LTRlYmEtYjY5MS0wNDM4Zjc3ZTNkMzMiLCJpYXQiOjE3Nzk4Mzk3ODMsImV4cCI6MTc4MjQzMTc4M30.zJUQIn_wU1B0dJJ74CCAVTisMgaAqcLIYX0g6xbXgo4	\N	\N	2026-06-26 05:26:23.291	f	2026-05-27 05:26:23.291454
f19e5e3e-c5c7-472f-8a9e-2076c52a2c39	c2fd6bc5-5766-4eba-b691-0438f77e3d33	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjMmZkNmJjNS01NzY2LTRlYmEtYjY5MS0wNDM4Zjc3ZTNkMzMiLCJpYXQiOjE3Nzk4Mzk3ODUsImV4cCI6MTc4MjQzMTc4NX0.nvljLF11rqWKHRXxCNsCbHk02PEs2fHt9Hdbp8BzNMM	\N	\N	2026-06-26 05:26:25.42	f	2026-05-27 05:26:25.420918
6f10b4ae-53ff-45d6-909c-c154caa49f50	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk4Nzc3MDQsImV4cCI6MTc4MjQ2OTcwNH0.aWXaC8WRg_MY6fqvwqSb4v3kF6qNg-fdMnPBk45jOeg	\N	\N	2026-06-26 15:58:24.992	f	2026-05-27 15:58:24.993151
642e25ae-f058-41d3-b59f-213380c49f0e	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk4Nzc5MDIsImV4cCI6MTc4MjQ2OTkwMn0.M_1ZflfgOiq03D_qUt4hZ9kOHp8k6QFesRoIqudws5Q	\N	\N	2026-06-26 16:01:42.437	f	2026-05-27 16:01:42.437313
fa77e4d9-b78b-4dcc-ace8-a9704969c6b3	6e38cbca-9dc0-4b75-98f8-6ebbe508c90d	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2ZTM4Y2JjYS05ZGMwLTRiNzUtOThmOC02ZWJiZTUwOGM5MGQiLCJpYXQiOjE3Nzk4Nzk5OTAsImV4cCI6MTc4MjQ3MTk5MH0.--sjf64_pbvpj7Csr55BEHY_ZgNVlCbZj6l3raZkwX8	\N	\N	2026-06-26 16:36:30.953	f	2026-05-27 16:36:30.954229
8abf7be2-88f0-494f-86da-5ea6fc0e3bc6	6e38cbca-9dc0-4b75-98f8-6ebbe508c90d	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2ZTM4Y2JjYS05ZGMwLTRiNzUtOThmOC02ZWJiZTUwOGM5MGQiLCJpYXQiOjE3Nzk4ODEzNDcsImV4cCI6MTc4MjQ3MzM0N30.zMclWsW6LMtElbjG0BdlpLmkzuS10iZMo0rLJOoTaEo	\N	\N	2026-06-26 16:59:07.973	f	2026-05-27 16:59:07.97398
51367991-73dc-4b9f-beb2-159655cdc617	6e38cbca-9dc0-4b75-98f8-6ebbe508c90d	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2ZTM4Y2JjYS05ZGMwLTRiNzUtOThmOC02ZWJiZTUwOGM5MGQiLCJpYXQiOjE3Nzk4ODEzNjMsImV4cCI6MTc4MjQ3MzM2M30.EaTz-NN1b6_YFwYfqKC1Oe7GJs5pkbFu0yr0EAfrxUQ	\N	\N	2026-06-26 16:59:23.598	f	2026-05-27 16:59:23.598436
ceb23b3d-b74f-492f-a5ca-3f947d713ab0	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk4ODEzNzQsImV4cCI6MTc4MjQ3MzM3NH0.Oay13rpqHSN3dle4DQ9pS3aA2Vz-NjdnuXt1rnOCP9g	\N	\N	2026-06-26 16:59:34.953	f	2026-05-27 16:59:34.953418
2c7157d5-6f6b-4a72-bc5e-8a857eeae4d7	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk4ODI4MjYsImV4cCI6MTc4MjQ3NDgyNn0.aZqgyuWDKYnM-1wv2W0fm0Atu-OAL8MfCUwxQw0xYYc	\N	\N	2026-06-26 17:23:46.62	f	2026-05-27 17:23:46.621322
754b25ae-2cae-4a5c-84b1-4ab1e7ebf5df	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk4ODI4MzUsImV4cCI6MTc4MjQ3NDgzNX0.IOfSjyEnRzSW-JB_EXWc8lj0jLpfvETpvLITL-Lw66I	\N	\N	2026-06-26 17:23:55.794	f	2026-05-27 17:23:55.794491
59f62c26-ed67-4b89-a4a2-e6a250c43305	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk4ODMzMTEsImV4cCI6MTc4MjQ3NTMxMX0.k7wgQc4H_G05K1dk7C7u8vvKKS7sqXhQq3z-Vw5_Wrk	\N	\N	2026-06-26 17:31:51.414	f	2026-05-27 17:31:51.41518
113f012e-540c-4f7b-bf01-b881d1254b90	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk4NzgyMzQsImV4cCI6MTc4MjQ3MDIzNH0.dVbzTniOzodtdiW2YO9xBd8BZdzrBjR9sCZIhcNxj40	\N	\N	2026-06-26 16:07:14.016	t	2026-05-27 16:07:14.017073
a6f540b8-d8b3-4389-95b4-929c8ec922eb	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk4ODM1MzcsImV4cCI6MTc4MjQ3NTUzN30.d3tk5p1nI46gP_wDWpdnsrI_VO3vJH191ntwh7Bikl8	\N	\N	2026-06-26 17:35:37.127	f	2026-05-27 17:35:37.127317
0510005b-8c66-4449-abcf-873fb3ed8491	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk4ODM1NTksImV4cCI6MTc4MjQ3NTU1OX0.3PPG9nxLHuis-7j_iNWTbTbPTjxjV_gFRMaHDbGqkbQ	\N	\N	2026-06-26 17:35:59.624	f	2026-05-27 17:35:59.625181
d5c0e473-cfe7-4dbc-bd57-d71b14fa2cc1	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk4ODM1NzIsImV4cCI6MTc4MjQ3NTU3Mn0.5TNMwPTB9Wn--cOIRFFilaJ2m61fNTtJWStEo1ryeS8	\N	\N	2026-06-26 17:36:12.414	f	2026-05-27 17:36:12.414714
77527449-ac6c-4871-a713-7b4e0ded4af5	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk4ODM2NDIsImV4cCI6MTc4MjQ3NTY0Mn0.LM6wq-5MvQV02glkk4ZiyvItk0cgh9VWx7ykLHLhVNM	\N	\N	2026-06-26 17:37:22.562	f	2026-05-27 17:37:22.562712
26b1d39f-4259-4a46-a528-325aabb8e1a0	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk4ODM2NDQsImV4cCI6MTc4MjQ3NTY0NH0.j3E0q2KmLPv6C1R6QrufZEG9LQUnBxAo9VOMnfUz6A4	\N	\N	2026-06-26 17:37:24.543	f	2026-05-27 17:37:24.544228
9de7d993-70cb-43cf-a043-112f26f081e5	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk4ODUxNTksImV4cCI6MTc4MjQ3NzE1OX0.WjI47P4jC1vd-wNJ9whuBfrwFDM6GRILOFbQgDgbvaQ	\N	\N	2026-06-26 18:02:39.848	f	2026-05-27 18:02:39.848985
90b3ecb0-f831-4e6f-88ec-84964e4a8626	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk4ODUyNzksImV4cCI6MTc4MjQ3NzI3OX0.kDB_0HIELg26ZO4FraPGSovW2fq0ipmQdjfjQgdI_w8	\N	\N	2026-06-26 18:04:39.193	f	2026-05-27 18:04:39.193448
6b0aadea-c350-4030-94eb-689964cd1d79	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk4ODU4MjIsImV4cCI6MTc4MjQ3NzgyMn0.ZwM5uEoKAdOKVnqtiAJk7lGbNT3mb53nNuLTFLMxwOA	\N	\N	2026-06-26 18:13:42.054	f	2026-05-27 18:13:42.054676
2453e8b1-efa7-48b3-a762-e4752f7742f1	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk4ODM2NDcsImV4cCI6MTc4MjQ3NTY0N30.9p0tIXQBn4OQ5No3mO9Jb6LHCMvN-St99k1bXtq7NNc	\N	\N	2026-06-26 17:37:27.792	t	2026-05-27 17:37:27.792173
d384bc02-f823-4998-948a-9f00d109fae5	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk4ODk2MTYsImV4cCI6MTc4MjQ4MTYxNn0.2resvZJY4k3z9OlyQWarMRxotX2nukvA_t1C8Ejhwdw	\N	\N	2026-06-26 19:16:56.084	t	2026-05-27 19:16:56.08445
2c512228-51c6-4b6b-9f3a-32435526641e	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk4OTMyMDksImV4cCI6MTc4MjQ4NTIwOX0.9G9kBXv1jj2BMjZhMvf3RhWMjoq7DaqJTNh3qXckR1M	\N	\N	2026-06-26 20:16:49.563	t	2026-05-27 20:16:49.563303
2ba1d434-a646-4bd1-9f7e-0a744e915c7b	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk4OTQzNTAsImV4cCI6MTc4MjQ4NjM1MH0.UyOuf0PrNHoXU0yyDHulZvdNdKfK3NyRLnJSS8Y5w3s	\N	\N	2026-06-26 20:35:50.231	f	2026-05-27 20:35:50.232057
d3e6f03b-a082-4ee5-8b61-f47ef7ea4532	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk4OTQzNTMsImV4cCI6MTc4MjQ4NjM1M30.uPrFlUAFFHLyLX7aKe5cD6nrA28L9EOVHKvzh81x8rc	\N	\N	2026-06-26 20:35:53.63	f	2026-05-27 20:35:53.631094
e0461780-3641-44f5-add8-ed96fa1b90e0	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk4OTQ3OTQsImV4cCI6MTc4MjQ4Njc5NH0.o4Gx2qAPrO9-uJ03vPmivVRCA5-VIrdC639WGWn1llo	\N	\N	2026-06-26 20:43:14.602	f	2026-05-27 20:43:14.60306
e2b054a4-7bf8-484e-bd23-a798e40f9719	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk4OTQ4MTMsImV4cCI6MTc4MjQ4NjgxM30.qCsq6XptlJZ_ktzsb8zEnLVgdZhArokIku3lgMMEDz0	\N	\N	2026-06-26 20:43:33.556	t	2026-05-27 20:43:33.556978
0b7c3717-56ca-46eb-b352-66813e07ec3e	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk4OTYyMTAsImV4cCI6MTc4MjQ4ODIxMH0.hMemn1R_EAQHlZOcTa-p9ORACH0OOEfD_WXplbddZq8	\N	\N	2026-06-26 21:06:50.927	f	2026-05-27 21:06:50.927977
c6cf1172-eb36-436c-80ed-8b2e0a1cb9b6	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk4OTYyMTAsImV4cCI6MTc4MjQ4ODIxMH0.hMemn1R_EAQHlZOcTa-p9ORACH0OOEfD_WXplbddZq8	\N	\N	2026-06-26 21:06:50.928	f	2026-05-27 21:06:50.928556
3f726590-b9d3-4610-b056-4dfb0b9b1615	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk4OTYyMTAsImV4cCI6MTc4MjQ4ODIxMH0.hMemn1R_EAQHlZOcTa-p9ORACH0OOEfD_WXplbddZq8	\N	\N	2026-06-26 21:06:50.928	f	2026-05-27 21:06:50.929088
b8a288df-ff40-43ad-a063-4b7e4e4f9001	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk4OTYyMTAsImV4cCI6MTc4MjQ4ODIxMH0.hMemn1R_EAQHlZOcTa-p9ORACH0OOEfD_WXplbddZq8	\N	\N	2026-06-26 21:06:50.929	f	2026-05-27 21:06:50.929674
42231ec4-1fcf-4adb-94a6-9834f769c6c8	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3Nzk4OTcwNzIsImV4cCI6MTc4MjQ4OTA3Mn0.14_KyTMWFvK586SWnBKDswDEF-oG_VEV-enfaOg4Uis	\N	\N	2026-06-26 21:21:12.531	f	2026-05-27 21:21:12.532165
28b5a7b3-b53b-4f00-962e-e084c3b30df0	6e38cbca-9dc0-4b75-98f8-6ebbe508c90d	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2ZTM4Y2JjYS05ZGMwLTRiNzUtOThmOC02ZWJiZTUwOGM5MGQiLCJpYXQiOjE3Nzk4OTcwOTEsImV4cCI6MTc4MjQ4OTA5MX0.QXwEjndYzP6wcLnALJyAw8Jb8DcZ58vdZqyXf3VJIxc	\N	\N	2026-06-26 21:21:31.27	f	2026-05-27 21:21:31.270844
1a37cf85-2fe0-4981-99a2-f58c481fb221	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk4OTcyNDksImV4cCI6MTc4MjQ4OTI0OX0.WaKddYFgbEjI1rR6NHZImnisv3Wj-NSEkPkKzGPZROI	\N	\N	2026-06-26 21:24:09.317	f	2026-05-27 21:24:09.317732
166074ed-b076-4dcb-8c0c-15ce6641788b	6e38cbca-9dc0-4b75-98f8-6ebbe508c90d	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2ZTM4Y2JjYS05ZGMwLTRiNzUtOThmOC02ZWJiZTUwOGM5MGQiLCJpYXQiOjE3Nzk4OTc0ODgsImV4cCI6MTc4MjQ4OTQ4OH0.fFW8L-fP5NgYDTSIEGvYueYD4noTyA8eLLb-HiNlUnc	\N	\N	2026-06-26 21:28:08.094	f	2026-05-27 21:28:08.094294
9caf5c1a-33d6-46e2-85ce-84bc8f07c406	6e38cbca-9dc0-4b75-98f8-6ebbe508c90d	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2ZTM4Y2JjYS05ZGMwLTRiNzUtOThmOC02ZWJiZTUwOGM5MGQiLCJpYXQiOjE3Nzk4OTc1MzAsImV4cCI6MTc4MjQ4OTUzMH0.72XfGPcthBe-cJrxh8Eh4QuoDrkt5cyK7QzwTMV74PI	\N	\N	2026-06-26 21:28:50.132	f	2026-05-27 21:28:50.132186
59cf101e-5342-49df-a574-b7940a336603	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk4OTc1NTEsImV4cCI6MTc4MjQ4OTU1MX0.WDKXK-2YW5qKwlbmpROxTqjBn0e56rHMGNcurH7dmro	\N	\N	2026-06-26 21:29:11.964	f	2026-05-27 21:29:11.964471
78a3c880-81c0-4374-915b-7081a40c0d93	6e38cbca-9dc0-4b75-98f8-6ebbe508c90d	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2ZTM4Y2JjYS05ZGMwLTRiNzUtOThmOC02ZWJiZTUwOGM5MGQiLCJpYXQiOjE3Nzk4OTc2MzcsImV4cCI6MTc4MjQ4OTYzN30.ztj5uXesCN0Xy_ExT4ZAhzC6G95OBYqflRP4xg4n9tw	\N	\N	2026-06-26 21:30:37.194	t	2026-05-27 21:30:37.194445
e505d198-c6be-4854-afc7-689a238f65f6	6e38cbca-9dc0-4b75-98f8-6ebbe508c90d	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2ZTM4Y2JjYS05ZGMwLTRiNzUtOThmOC02ZWJiZTUwOGM5MGQiLCJpYXQiOjE3Nzk4OTkxNjQsImV4cCI6MTc4MjQ5MTE2NH0.OAfwHzvg9ZFXZjhU-nbPlWQZOsrnGUG4oFBZikIzoio	\N	\N	2026-06-26 21:56:04.429	t	2026-05-27 21:56:04.429857
461ba4b0-59ec-45ab-8bee-f160d19502de	6e38cbca-9dc0-4b75-98f8-6ebbe508c90d	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2ZTM4Y2JjYS05ZGMwLTRiNzUtOThmOC02ZWJiZTUwOGM5MGQiLCJpYXQiOjE3Nzk5MDE0OTAsImV4cCI6MTc4MjQ5MzQ5MH0.E0OY6c3QWFJeFdhPWG7HMFNTlTcE0DxzpOlMNXjvk9c	\N	\N	2026-06-26 22:34:50.102	f	2026-05-27 22:34:50.102506
52430c0d-2a96-4677-893f-bbbe5f26331b	6e38cbca-9dc0-4b75-98f8-6ebbe508c90d	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2ZTM4Y2JjYS05ZGMwLTRiNzUtOThmOC02ZWJiZTUwOGM5MGQiLCJpYXQiOjE3Nzk5MDE0OTAsImV4cCI6MTc4MjQ5MzQ5MH0.E0OY6c3QWFJeFdhPWG7HMFNTlTcE0DxzpOlMNXjvk9c	\N	\N	2026-06-26 22:34:50.103	f	2026-05-27 22:34:50.103189
9f15b9b9-a19c-4649-a78a-02faaae42b67	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk5MDE2MTUsImV4cCI6MTc4MjQ5MzYxNX0.1ji0hC_fycz_lqH4tmmeofMimzDOBibkjfKhGBLznjU	\N	\N	2026-06-26 22:36:55.307	f	2026-05-27 22:36:55.307599
1ae6ce3a-679f-48c0-9030-841a7e3da395	6e38cbca-9dc0-4b75-98f8-6ebbe508c90d	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2ZTM4Y2JjYS05ZGMwLTRiNzUtOThmOC02ZWJiZTUwOGM5MGQiLCJpYXQiOjE3Nzk5MDIwMzIsImV4cCI6MTc4MjQ5NDAzMn0.zCeWl5ozEfdztgd3PexNNNcJagJGPDp-dE3z7lwGP74	\N	\N	2026-06-26 22:43:52.291	t	2026-05-27 22:43:52.292197
83af7052-62f3-4703-9d09-05c514a689c7	6e38cbca-9dc0-4b75-98f8-6ebbe508c90d	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2ZTM4Y2JjYS05ZGMwLTRiNzUtOThmOC02ZWJiZTUwOGM5MGQiLCJpYXQiOjE3Nzk5MDI5MzIsImV4cCI6MTc4MjQ5NDkzMn0.PrYaQ1FAJQTPraAXDx_MpVbEsyU2NUkPQf04HeGoJGI	\N	\N	2026-06-26 22:58:52.168	f	2026-05-27 22:58:52.168582
c0245bff-541e-40d8-9bfa-71d98673f8c1	6e38cbca-9dc0-4b75-98f8-6ebbe508c90d	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2ZTM4Y2JjYS05ZGMwLTRiNzUtOThmOC02ZWJiZTUwOGM5MGQiLCJpYXQiOjE3Nzk5MDI5MzIsImV4cCI6MTc4MjQ5NDkzMn0.PrYaQ1FAJQTPraAXDx_MpVbEsyU2NUkPQf04HeGoJGI	\N	\N	2026-06-26 22:58:52.169	f	2026-05-27 22:58:52.169624
5d3eb376-c99a-48ed-a1ba-693dc7789c85	6e38cbca-9dc0-4b75-98f8-6ebbe508c90d	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2ZTM4Y2JjYS05ZGMwLTRiNzUtOThmOC02ZWJiZTUwOGM5MGQiLCJpYXQiOjE3Nzk5MDI5MzYsImV4cCI6MTc4MjQ5NDkzNn0.TJ6tIWNqdKsJ6tUD5N36VxgmYoWQGkky_kHKG1myhQI	\N	\N	2026-06-26 22:58:56.151	f	2026-05-27 22:58:56.151445
6bec0765-67f5-4ab7-8e2d-88101a98c4b1	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk5MDYzNTUsImV4cCI6MTc4MjQ5ODM1NX0.ZwNawigsE10ssctBgy730WNwDVWllZjb38a508iVaTg	\N	\N	2026-06-26 23:55:55.883	t	2026-05-27 23:55:55.88353
193e5729-1a4f-480f-bbfd-c9e16f597c92	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk5MDYzNzEsImV4cCI6MTc4MjQ5ODM3MX0.ZVhC_Mhg073wBm1_VGKDHo64Hr81t4GkfLQggef0yQM	\N	\N	2026-06-26 23:56:11.469	t	2026-05-27 23:56:11.469339
f4e94805-d9e6-4fc0-99d3-ed6fdda8a0e7	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3Nzk5MDMyMzMsImV4cCI6MTc4MjQ5NTIzM30.xqnImQGCWpglmBiTodWjfHQwf_UgLkCG8Dgcw2uHlWo	\N	\N	2026-06-26 23:03:53.38	t	2026-05-27 23:03:53.38058
ac7348df-d228-4e3e-9a15-adc90d3ee547	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3Nzk5MDQ5MDMsImV4cCI6MTc4MjQ5NjkwM30.Zy06rT4IrGqqKTn3I8x_q87rIpz1sZxu3fxyYmmjOY0	\N	\N	2026-06-26 23:31:43.804	f	2026-05-27 23:31:43.804341
789bc531-d42c-469e-be0f-c262a75279f0	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3Nzk5MDQ5MDMsImV4cCI6MTc4MjQ5NjkwM30.Zy06rT4IrGqqKTn3I8x_q87rIpz1sZxu3fxyYmmjOY0	\N	\N	2026-06-26 23:31:43.805	f	2026-05-27 23:31:43.805125
6cbf9fc0-0cd7-49a9-8c88-007148f3a28d	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3Nzk5MDQ5MDMsImV4cCI6MTc4MjQ5NjkwM30.Zy06rT4IrGqqKTn3I8x_q87rIpz1sZxu3fxyYmmjOY0	\N	\N	2026-06-26 23:31:43.805	f	2026-05-27 23:31:43.806019
565d6b79-a8c0-4b9b-83a7-65e8be54802d	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk5MDQ5MzksImV4cCI6MTc4MjQ5NjkzOX0.W5Xe0kOST6TKVmqg2CQ__P_lARsT_jeucYFfmm6FNsQ	\N	\N	2026-06-26 23:32:19.786	f	2026-05-27 23:32:19.78667
1d3c2cc8-c911-4b55-bfc3-a721e95cfc1b	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk5MDQ5OTcsImV4cCI6MTc4MjQ5Njk5N30.Cb62BVyE7JtO793pI0FJ6n-vWjAbPk1Am3m9b26ClHc	\N	\N	2026-06-26 23:33:17.282	f	2026-05-27 23:33:17.282954
88cc6d2c-500a-4f8f-99db-019a14d0cd25	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk5MDUwNDgsImV4cCI6MTc4MjQ5NzA0OH0.z-G2Ni8Qwp_Dzo4PlHfBCW8TFzrHdLdAErlQHlUftIE	\N	\N	2026-06-26 23:34:08.051	f	2026-05-27 23:34:08.051779
a8f61b54-2ab9-456f-882b-f816c48787e7	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk5MDc1MTMsImV4cCI6MTc4MjQ5OTUxM30.t0lhEyT40O9Z8cwz3QwcI8qemXnbqBl91BxfkZLyMj4	\N	\N	2026-06-27 00:15:13.447	f	2026-05-28 00:15:13.447424
c03bec4a-c79e-438f-a67a-0f092cb8e0c5	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk5MDU0NDAsImV4cCI6MTc4MjQ5NzQ0MH0.5gfDVEqshwEYOoUHd6WFe_wVdT4rH1YcyGoguj6jvAw	\N	\N	2026-06-26 23:40:40.225	t	2026-05-27 23:40:40.226038
dd37b998-c127-4066-ba4c-a81c80c95f87	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk5MDYzNTMsImV4cCI6MTc4MjQ5ODM1M30.J7jlnQRzsMJZRfRUPZ_HS3PcSNfRHHM8jJQPr8h_ZzQ	\N	\N	2026-06-26 23:55:53.376	f	2026-05-27 23:55:53.376437
3c21edb3-e30d-41d6-9002-29a24406b531	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk5MDYzNTMsImV4cCI6MTc4MjQ5ODM1M30.J7jlnQRzsMJZRfRUPZ_HS3PcSNfRHHM8jJQPr8h_ZzQ	\N	\N	2026-06-26 23:55:53.377	f	2026-05-27 23:55:53.377312
4b832176-e0ef-443d-8e52-1b469e3887ce	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk5MDU0MzQsImV4cCI6MTc4MjQ5NzQzNH0.GcgTwm6KzJs1j4fvWqg6Vib-9XU1jW4-ln9-7MXRAw0	\N	\N	2026-06-26 23:40:34.23	t	2026-05-27 23:40:34.230375
7378677e-a9e7-49df-b75f-6c5ebb5fc8b4	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk5MDc1MTMsImV4cCI6MTc4MjQ5OTUxM30.t0lhEyT40O9Z8cwz3QwcI8qemXnbqBl91BxfkZLyMj4	\N	\N	2026-06-27 00:15:13.448	f	2026-05-28 00:15:13.448166
3843a507-ce2a-4945-9981-052c873312e0	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk5MDc1MTMsImV4cCI6MTc4MjQ5OTUxM30.t0lhEyT40O9Z8cwz3QwcI8qemXnbqBl91BxfkZLyMj4	\N	\N	2026-06-27 00:15:13.449	f	2026-05-28 00:15:13.449241
2b0cf0d7-db00-42e9-8a0c-8598fd717143	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3Nzk5MDc3NzYsImV4cCI6MTc4MjQ5OTc3Nn0.dtW8DQQiItniaiAxxcXSNt2jKPrD3lnl2zDFRf8Sy3A	\N	\N	2026-06-27 00:19:36.292	f	2026-05-28 00:19:36.292718
427451ca-929d-4e7f-9293-956e284447e0	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk5MDc3NjcsImV4cCI6MTc4MjQ5OTc2N30.CiyDDYBI23Rz7gLHWH0Tu8kHIOfngdHrcoRB4sPnYT8	\N	\N	2026-06-27 00:19:27.513	f	2026-05-28 00:19:27.513549
a487c323-7e23-4bcb-b919-ea4adea07610	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk5MDc3NjcsImV4cCI6MTc4MjQ5OTc2N30.CiyDDYBI23Rz7gLHWH0Tu8kHIOfngdHrcoRB4sPnYT8	\N	\N	2026-06-27 00:19:27.514	f	2026-05-28 00:19:27.514377
f4420de2-80e8-4f08-864c-fddc33cc8a3b	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk5MDc3NjcsImV4cCI6MTc4MjQ5OTc2N30.CiyDDYBI23Rz7gLHWH0Tu8kHIOfngdHrcoRB4sPnYT8	\N	\N	2026-06-27 00:19:27.515	f	2026-05-28 00:19:27.515245
de4affe8-fad3-410d-8453-b3df7af5c55f	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk5MDc3OTMsImV4cCI6MTc4MjQ5OTc5M30.QAo-86-_o_jTsly3gpMPk06nSnui1MkUhvRKou7n4hs	\N	\N	2026-06-27 00:19:53.211	f	2026-05-28 00:19:53.211191
d184b13a-9d2e-4ad5-8392-119d6a33bd6b	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3Nzk5MDc4MzUsImV4cCI6MTc4MjQ5OTgzNX0.wLf92IccU6ljuHOESOg5l73YVfaDkYrcKrDOwFgxpeg	\N	\N	2026-06-27 00:20:35.558	f	2026-05-28 00:20:35.558272
f6d82d8d-78ad-4362-84d3-d40da1f17d7e	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk5MDc5NzYsImV4cCI6MTc4MjQ5OTk3Nn0.DcT7lqFxkq23Fmjhi35Cm54iSl4L2hZLEgEa9TGFOWw	\N	\N	2026-06-27 00:22:56.027	f	2026-05-28 00:22:56.027904
342a1324-74f9-4484-9fc8-db143c57e04f	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3Nzk5MDgwMTIsImV4cCI6MTc4MjUwMDAxMn0.xmqzwuok_06YDyIBxZU502clV274CObNw1wspSO8_Vo	\N	\N	2026-06-27 00:23:32.794	f	2026-05-28 00:23:32.794549
5764544d-0506-417b-b002-6278fa58a656	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk5MDgwODUsImV4cCI6MTc4MjUwMDA4NX0.Qk4t7pty_zh3VddKVz5LU4wXuxAGEPNakUJRK_ZUEuE	\N	\N	2026-06-27 00:24:45.97	f	2026-05-28 00:24:45.97084
902c972e-339c-466e-804a-af4c803c6d6f	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3Nzk5MDg1NTEsImV4cCI6MTc4MjUwMDU1MX0.-O-R-pvoZW54S33zMnvFUTs9DyBzoOzHBjauhvY_krc	\N	\N	2026-06-27 00:32:31.284	f	2026-05-28 00:32:31.284915
8149a74a-c0cc-4643-9411-333b31216c94	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3Nzk5MDg2MDMsImV4cCI6MTc4MjUwMDYwM30.yxE_2x25xN22B15rjT4kcukkIRqRR6NJ0T5NQ8uC-1E	\N	\N	2026-06-27 00:33:23.155	f	2026-05-28 00:33:23.15542
c0480e60-f351-43ae-93f4-1fc2e400a0ba	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3Nzk5MDg2MDgsImV4cCI6MTc4MjUwMDYwOH0.MogK7lU6nqq4D1cjwYWYJM2gjyNg8OwVI_7sV5qZDxQ	\N	\N	2026-06-27 00:33:28.866	f	2026-05-28 00:33:28.866413
310ad545-8f4b-408d-a866-3331fe2f1446	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk5MDg2MzAsImV4cCI6MTc4MjUwMDYzMH0.2tRkq9V4DztKheyWdifVDYgcvLTztZu8neVgJvBe9S8	\N	\N	2026-06-27 00:33:50.02	f	2026-05-28 00:33:50.020362
c1b93c5e-2f8c-4fd9-981a-19f815ab1cd9	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk5MDc3NjksImV4cCI6MTc4MjQ5OTc2OX0.Gh-b4n8ObeIY6Janv0TnEoscz_ELJVtCSFrWze8j2_8	\N	\N	2026-06-27 00:19:29.966	t	2026-05-28 00:19:29.968991
a2643ab6-b8d6-4296-868f-963de15c97b4	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk5MDg2NzgsImV4cCI6MTc4MjUwMDY3OH0.yeoaucYULvb8YxXlJ7ZSfCjIFcDcn8yZewcdhrpwVmE	\N	\N	2026-06-27 00:34:38.414	f	2026-05-28 00:34:38.415012
f57f920d-3d7c-4c05-a3e8-b286a3332802	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3Nzk5MDg3MzgsImV4cCI6MTc4MjUwMDczOH0.F8SsH3luEa0WzkZQgJnvq43AgpM9_wacnHtv8s8Xpwk	\N	\N	2026-06-27 00:35:38.369	f	2026-05-28 00:35:38.369738
a77dbcc6-5470-4010-81cb-e0bcf7ada4c2	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk5MDg3ODksImV4cCI6MTc4MjUwMDc4OX0.keuw3t5XCjDUC7ihIybCFHnq9oGpo-VE13l_Gt5cqvQ	\N	\N	2026-06-27 00:36:29.564	f	2026-05-28 00:36:29.56497
13853524-209d-4af0-bcb1-78b1c8d3ff55	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk5MDg4MjUsImV4cCI6MTc4MjUwMDgyNX0.Kk6M0JgYFXrXuEHz2GMCYs1cDiSaUn2aMKcby7f4ZZs	\N	\N	2026-06-27 00:37:05.231	f	2026-05-28 00:37:05.232072
a5902c9e-fdc3-4311-a7bd-a00623561c09	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3Nzk5MDg4MzEsImV4cCI6MTc4MjUwMDgzMX0.HoNVAwCvyXGscz2e7Un7PiKQo13n50YLz19X84s-Dpk	\N	\N	2026-06-27 00:37:11.041	f	2026-05-28 00:37:11.041403
400b7a11-e13f-49a7-be83-cd5937f83355	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk5MTA1ODMsImV4cCI6MTc4MjUwMjU4M30.8hx8LDG7mvTp4oP-LUIjxhCa6oVo-Smw_xeeZASrMvg	\N	\N	2026-06-27 01:06:23.795	t	2026-05-28 01:06:23.795681
a18b0fce-e57e-419e-aa6a-7fad8f9ccdec	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk5MDkzMDksImV4cCI6MTc4MjUwMTMwOX0.REBcSOoAnWRuiOr6uUjMbUOc9TyhPOZga5YxVtszjrI	\N	\N	2026-06-27 00:45:09.173	t	2026-05-28 00:45:09.17351
e77e301c-5967-4e9c-88d8-fe42bd34ac90	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk5MTAzNDcsImV4cCI6MTc4MjUwMjM0N30.lmV_Osd3P766Pxnt4ilm1-vVVCbzLqhJ_FNTJTG74bo	\N	\N	2026-06-27 01:02:27.076	f	2026-05-28 01:02:27.076582
83f9aed0-4fa6-461c-96d0-816f8e982e5a	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk5MTAzNDcsImV4cCI6MTc4MjUwMjM0N30.lmV_Osd3P766Pxnt4ilm1-vVVCbzLqhJ_FNTJTG74bo	\N	\N	2026-06-27 01:02:27.077	f	2026-05-28 01:02:27.077527
684244d0-a9a7-48f4-850e-f61cd3d0f6c5	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk5MDkzNDYsImV4cCI6MTc4MjUwMTM0Nn0.wRMH6KQeow4IKTPDGB_ak3TNkCO-hix22xKSLq5_DhU	\N	\N	2026-06-27 00:45:46.715	t	2026-05-28 00:45:46.715329
930ebcba-46d6-49ab-bec4-acc3c8fbbcd3	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk5MTAyNTYsImV4cCI6MTc4MjUwMjI1Nn0.Dffig_rAwG7jev0n0zO_polOYdL9c4MBFebXsF62rVQ	\N	\N	2026-06-27 01:00:56.758	f	2026-05-28 01:00:56.759122
d80381c6-87dd-4475-8d27-c53d16c11552	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk5MTAyNTYsImV4cCI6MTc4MjUwMjI1Nn0.Dffig_rAwG7jev0n0zO_polOYdL9c4MBFebXsF62rVQ	\N	\N	2026-06-27 01:00:56.759	f	2026-05-28 01:00:56.759729
e03b051e-e3e6-40e0-b834-74e485594fa7	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk5MTAyNTYsImV4cCI6MTc4MjUwMjI1Nn0.Dffig_rAwG7jev0n0zO_polOYdL9c4MBFebXsF62rVQ	\N	\N	2026-06-27 01:00:56.76	f	2026-05-28 01:00:56.760292
c6c72813-a367-4a61-ba32-9de45ee32ed0	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk5MTAyNTYsImV4cCI6MTc4MjUwMjI1Nn0.Dffig_rAwG7jev0n0zO_polOYdL9c4MBFebXsF62rVQ	\N	\N	2026-06-27 01:00:56.761	f	2026-05-28 01:00:56.762072
ef7c0d91-2fd9-4ad1-8492-e7ea141ea8cb	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk5MTAyNTYsImV4cCI6MTc4MjUwMjI1Nn0.Dffig_rAwG7jev0n0zO_polOYdL9c4MBFebXsF62rVQ	\N	\N	2026-06-27 01:00:56.762	f	2026-05-28 01:00:56.762623
de440058-58bb-4c7d-9aab-658c9309fce0	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk5MTAyNTgsImV4cCI6MTc4MjUwMjI1OH0.IxhKRqWXm0TMONDPClzOBtPB_nwis1UyfKMEC_v78qs	\N	\N	2026-06-27 01:00:58.792	f	2026-05-28 01:00:58.792217
62058921-57e8-4c4b-8f9b-a55df738df59	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3Nzk5MTA4NjAsImV4cCI6MTc4MjUwMjg2MH0.dkDK407EH9kieKSYwnc-lMeUMlq5sTnFU7bJ6YTpbMA	\N	\N	2026-06-27 01:11:00.256	t	2026-05-28 01:11:00.256757
ed6623fc-e463-4a85-856f-180c9a6658e7	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk5MTQzOTcsImV4cCI6MTc4MjUwNjM5N30.xU0GK0NwaZfjGA19MAb5f4bjMqzjH4jocqp6VLAwOuU	\N	\N	2026-06-27 02:09:57.085	t	2026-05-28 02:09:57.086039
c7c7891c-90be-40a2-9cd6-21fda1d1b8a4	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3Nzk5MTQ0MzAsImV4cCI6MTc4MjUwNjQzMH0.IPcXzwFegIEgeNjSDh0c0a3DpB5ZXn5SyWkTTaDp7jE	\N	\N	2026-06-27 02:10:30.336	t	2026-05-28 02:10:30.336578
ea7b332c-08e6-40df-8faf-6156bb0566a5	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3Nzk5MTgzMTIsImV4cCI6MTc4MjUxMDMxMn0.iDcqapWikr-ItNmnbsDkBMFAePbU6Md8-XXEFQhveYE	\N	\N	2026-06-27 03:15:12.153	t	2026-05-28 03:15:12.15363
b69fe5c1-fd76-4253-8e5e-83df25e91b54	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3Nzk5MjE5NzcsImV4cCI6MTc4MjUxMzk3N30.cJDE1E0iSpuEVUkxusj56Q0t2rIYaPAaOq_CpZ4Dn4w	\N	\N	2026-06-27 04:16:17.981	t	2026-05-28 04:16:17.982044
18d0d81d-3b57-42d2-b376-d88a9d63c7b0	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk5MjUxNzgsImV4cCI6MTc4MjUxNzE3OH0.fN2UDtNJP7paEGE1l3mp_qjvQNWasrJiXufvLr5rltA	\N	\N	2026-06-27 05:09:38.273	t	2026-05-28 05:09:38.273394
2af1d364-4b23-49e0-87f7-91a67b9d3d58	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3Nzk5MjU1NDgsImV4cCI6MTc4MjUxNzU0OH0.zoain5mNB0bDSbLojirBx5xCLnlcFr26BbaZKGUC7Rk	\N	\N	2026-06-27 05:15:48.014	t	2026-05-28 05:15:48.014841
d9d752ad-9179-4788-9b45-6b1b01781fc0	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3Nzk5MjkxNjAsImV4cCI6MTc4MjUyMTE2MH0.EZJHj1jy9Yma-dLDpGLB4eqgvoVd_pnLWpW5RV49snI	\N	\N	2026-06-27 06:16:00.462	t	2026-05-28 06:16:00.463286
6f9fad92-8f5f-4ac1-a01c-653cc1322a04	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3Nzk5MzI3MzAsImV4cCI6MTc4MjUyNDczMH0.0MjczCSTE___YFKKKluVk3i2KfuccNAVlLbCFDd8b1A	\N	\N	2026-06-27 07:15:30.558	t	2026-05-28 07:15:30.558925
c4415cdf-3354-407d-808b-8241668c0670	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3Nzk5MzYzMDAsImV4cCI6MTc4MjUyODMwMH0.VDKGXAkzdOy9P4IY3LyMUZ_l4bQKbriIzDoVHmad7mE	\N	\N	2026-06-27 08:15:00.662	t	2026-05-28 08:15:00.66272
6557a21a-eb74-44b2-9d49-eca3ee2eaf66	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3Nzk5Mzk4NzAsImV4cCI6MTc4MjUzMTg3MH0.O3YmilhtZdh2fAj8x9A8HchajqPubEK2ZREoXkwniWE	\N	\N	2026-06-27 09:14:30.749	t	2026-05-28 09:14:30.749633
d8ee463b-d4c9-426b-b696-816bd2f5f41e	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3Nzk5NDM0NDAsImV4cCI6MTc4MjUzNTQ0MH0.6iktxibPan5NxSE10qMFOPokF_-wbt-I9RgHxZJd5G0	\N	\N	2026-06-27 10:14:00.839	t	2026-05-28 10:14:00.839583
d050ff8b-87f9-475f-8bb1-d9eff79a9040	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3Nzk5NDcwMTAsImV4cCI6MTc4MjUzOTAxMH0.jB3Ac7qzQCz6ZdSlbClGnQS2ogaa8MXrgscnLP_AVmE	\N	\N	2026-06-27 11:13:30.931	t	2026-05-28 11:13:30.93183
d799fd00-d9b5-4a91-a02f-f5074ed268f5	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3Nzk5NTA1ODEsImV4cCI6MTc4MjU0MjU4MX0.mBmPBtBv_uPANB1ddP8rRY5a3ACW44n_LdP18tJKC_E	\N	\N	2026-06-27 12:13:01.029	t	2026-05-28 12:13:01.029936
f13af744-c5bd-4eeb-8b12-e3c211cf6455	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk5NTYxNjUsImV4cCI6MTc4MjU0ODE2NX0.NgHO0D4HAQwYiRLx_Wkiaxq01o04YcXZBRUPAsaVB7k	\N	\N	2026-06-27 13:46:05.082	f	2026-05-28 13:46:05.082699
2a978365-e768-4f9c-bbda-7677c47e5ac2	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk5NTYxNzAsImV4cCI6MTc4MjU0ODE3MH0.tIvJHpyBu7jOsnUAYQNKzUpPyZqVQcXNn0YT7r0WwyY	\N	\N	2026-06-27 13:46:10.368	f	2026-05-28 13:46:10.368808
f56c9916-a47e-4513-a91f-2da59fcfcdac	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk5NTYxNzcsImV4cCI6MTc4MjU0ODE3N30.rE_Nt5StvU83ex3jBDDglvpVIzHWDlJmYsN8rSLLEg0	\N	\N	2026-06-27 13:46:17.735	f	2026-05-28 13:46:17.735196
b7185075-d4f8-4e4c-b9b5-dc21b507815b	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3Nzk5NTQxNTEsImV4cCI6MTc4MjU0NjE1MX0.Lj5672bQxc22u5Tm16mp8FwP9dfVtpc-YcRgJIhcne0	\N	\N	2026-06-27 13:12:31.119	t	2026-05-28 13:12:31.119373
02a3c448-4a35-4312-ae52-5d2940f9aadc	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3Nzk5NTYxNDIsImV4cCI6MTc4MjU0ODE0Mn0.ZdxoC0fa4WCDe0-VcxebDVvVWWbKKEJ83tCzardhEVg	\N	\N	2026-06-27 13:45:42.901	f	2026-05-28 13:45:42.902203
bbaf5753-243a-47c9-bc29-dcfcc65a0ee1	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3Nzk5NTYxNDIsImV4cCI6MTc4MjU0ODE0Mn0.ZdxoC0fa4WCDe0-VcxebDVvVWWbKKEJ83tCzardhEVg	\N	\N	2026-06-27 13:45:42.902	f	2026-05-28 13:45:42.902896
0376eed9-b320-416b-9943-da3c317a482e	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3Nzk5NTYxNDIsImV4cCI6MTc4MjU0ODE0Mn0.ZdxoC0fa4WCDe0-VcxebDVvVWWbKKEJ83tCzardhEVg	\N	\N	2026-06-27 13:45:42.903	f	2026-05-28 13:45:42.903468
bfe1fdcd-a1e7-4796-bca7-3aa6b860d7db	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3Nzk5NTYxNDIsImV4cCI6MTc4MjU0ODE0Mn0.ZdxoC0fa4WCDe0-VcxebDVvVWWbKKEJ83tCzardhEVg	\N	\N	2026-06-27 13:45:42.903	f	2026-05-28 13:45:42.903958
902ac276-2359-443c-8090-a81aff42f152	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3Nzk5NTYyNTMsImV4cCI6MTc4MjU0ODI1M30.fn-GLsQdy1pxoXIlKXLrefd6VF2ml-dv9l1a5ICNflE	\N	\N	2026-06-27 13:47:33.038	f	2026-05-28 13:47:33.038896
e504982b-5948-4e05-9092-6cf1449d245e	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk5Mjg3NDgsImV4cCI6MTc4MjUyMDc0OH0.AIhW9CxWW3Hlcfotv_sHY9YvdjR6XL1J3VSpUEDN8Bc	\N	\N	2026-06-27 06:09:08.34	t	2026-05-28 06:09:08.3409
ac26b817-ec8f-40a6-938c-3f61207e5f24	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk5NTYxNjUsImV4cCI6MTc4MjU0ODE2NX0.NgHO0D4HAQwYiRLx_Wkiaxq01o04YcXZBRUPAsaVB7k	\N	\N	2026-06-27 13:46:05.08	f	2026-05-28 13:46:05.080863
4bf4074b-1a8e-479a-8ceb-3803e23f4661	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk5NTYxNjUsImV4cCI6MTc4MjU0ODE2NX0.NgHO0D4HAQwYiRLx_Wkiaxq01o04YcXZBRUPAsaVB7k	\N	\N	2026-06-27 13:46:05.081	f	2026-05-28 13:46:05.081439
f2fdbe9b-33a1-4735-a71e-de1f8fd17081	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk5NTYzODgsImV4cCI6MTc4MjU0ODM4OH0.v3ngYN-VwTSCTD8b_mU2OlFp66OZynvuHnZ_fKmI1rw	\N	\N	2026-06-27 13:49:48.305	f	2026-05-28 13:49:48.305923
c1ec99a6-05a9-485e-8a9a-77bc6c35b39b	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3Nzk5NTYzOTEsImV4cCI6MTc4MjU0ODM5MX0.eupHMWsryltxFcL3QSYjImGd1iQvb1K20vV6rkacysE	\N	\N	2026-06-27 13:49:51.455	f	2026-05-28 13:49:51.456024
ea031b3f-0234-485e-b3d2-dbb9f01b1b82	6e38cbca-9dc0-4b75-98f8-6ebbe508c90d	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2ZTM4Y2JjYS05ZGMwLTRiNzUtOThmOC02ZWJiZTUwOGM5MGQiLCJpYXQiOjE3Nzk5NTY1OTksImV4cCI6MTc4MjU0ODU5OX0.WQGF6yr2wHpvAJec5v6Qy5s7o6wEU5N-oDY06wAVugs	\N	\N	2026-06-27 13:53:19.751	f	2026-05-28 13:53:19.752128
583c582e-ac66-42f0-b601-9d4a8872bfee	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk5NTY2MjYsImV4cCI6MTc4MjU0ODYyNn0.iX5IFT-9TUhbSsDtItuoZuDADFveq6yt4OKFlitJqYU	\N	\N	2026-06-27 13:53:46.798	f	2026-05-28 13:53:46.798906
b6314f00-b350-45eb-a382-4155f94cfb9b	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk5NTY5MzYsImV4cCI6MTc4MjU0ODkzNn0.7bgcbL5S9BxKSha2wV1RbCoE0ASxaTL9e6URGcr7d20	\N	\N	2026-06-27 13:58:56.121	f	2026-05-28 13:58:56.121953
f4a137d7-ddb5-4ce2-816d-25dfa8eedab5	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk5NTY5NDAsImV4cCI6MTc4MjU0ODk0MH0.XUa9b-v95hog5ca2V_hwJDfu0Y8Da0w2Y2A200FLjKk	\N	\N	2026-06-27 13:59:00.058	f	2026-05-28 13:59:00.058867
aada39e2-0bea-40fb-b414-46489bb9aa91	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk5NTY5NDYsImV4cCI6MTc4MjU0ODk0Nn0.BsyOVM-O3SwND3MN-yzq6QPq5qNPV4VlrvJ1l7ucM3c	\N	\N	2026-06-27 13:59:06.49	f	2026-05-28 13:59:06.490266
c9c06c1f-0c1e-4dc6-9f4e-ac9fee6a93ca	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk5NTYyODIsImV4cCI6MTc4MjU0ODI4Mn0.zEJZ0ZELmJcPeXdekoAbQi4pGy0nlluklnCyuuQgNAo	\N	\N	2026-06-27 13:48:02.569	t	2026-05-28 13:48:02.569616
c5ca96c9-36d2-40fc-aac5-3a1a01722985	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk5NTczNjcsImV4cCI6MTc4MjU0OTM2N30.2AoZNTboHg3O2oBknxB4ul8hhgz3HqIgdZk-Zluxwmc	\N	\N	2026-06-27 14:06:07.931	t	2026-05-28 14:06:07.932161
de9248f5-bca2-4caa-8055-48ddd5ba7cd5	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk5NjAwMTUsImV4cCI6MTc4MjU1MjAxNX0.o_NwhgTasj9rw-Ea0Ou8JiIXq0VxHlTGuEfEeM0EJLY	\N	\N	2026-06-27 14:50:15.566	t	2026-05-28 14:50:15.567098
2180b61d-2155-4f87-b581-e10cd3a37f60	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk5NTcwNDEsImV4cCI6MTc4MjU0OTA0MX0.FBmvuihQtAjlmrKkQyiNLozPpfSEgxvtuO-KobwR-dc	\N	\N	2026-06-27 14:00:41.156	t	2026-05-28 14:00:41.156399
07cd0571-5298-47c6-a11d-1b922869ceae	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk5NTg1NjUsImV4cCI6MTc4MjU1MDU2NX0.eJ4C6zK0IunA0nfMOWUucX58TfbaZH-XjTesiht1a2o	\N	\N	2026-06-27 14:26:05.345	f	2026-05-28 14:26:05.346128
26c2df91-ad9a-422a-b7c4-d4c56a153b29	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk5NTg1NjUsImV4cCI6MTc4MjU1MDU2NX0.eJ4C6zK0IunA0nfMOWUucX58TfbaZH-XjTesiht1a2o	\N	\N	2026-06-27 14:26:05.348	f	2026-05-28 14:26:05.34887
161db204-d736-4014-9730-4d3d564d49a3	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk5NTg1NjUsImV4cCI6MTc4MjU1MDU2NX0.eJ4C6zK0IunA0nfMOWUucX58TfbaZH-XjTesiht1a2o	\N	\N	2026-06-27 14:26:05.36	f	2026-05-28 14:26:05.360733
271c1401-2db1-43d0-8a43-2b776289d269	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk5NTkwOTQsImV4cCI6MTc4MjU1MTA5NH0.pDzXLNUkqgGDD6fZAv9lnvIV6ytueQZdhyTC-EuZv_g	\N	\N	2026-06-27 14:34:54.573	t	2026-05-28 14:34:54.574126
67aa6e54-f92a-496d-81c8-60d05992000d	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk5NTkxODEsImV4cCI6MTc4MjU1MTE4MX0.eiwBR6pPue0LN69CiwcRZO3btE--uhWIERpKQufAtuw	\N	\N	2026-06-27 14:36:21.222	t	2026-05-28 14:36:21.222557
21735ff9-da2c-45cb-b407-468275c8a8a5	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk5NjAxNTUsImV4cCI6MTc4MjU1MjE1NX0.rl49DR0_IQMWxfKVsHrVmkVlxh1nPLoATROhkBCkvgo	\N	\N	2026-06-27 14:52:35.439	f	2026-05-28 14:52:35.43931
87422604-cca4-4bf4-b37f-b3a005943333	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk5NjAxNTUsImV4cCI6MTc4MjU1MjE1NX0.rl49DR0_IQMWxfKVsHrVmkVlxh1nPLoATROhkBCkvgo	\N	\N	2026-06-27 14:52:35.439	f	2026-05-28 14:52:35.439914
c5acef69-1e63-4f56-8b50-bfac812807d2	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk5NjAxNTUsImV4cCI6MTc4MjU1MjE1NX0.rl49DR0_IQMWxfKVsHrVmkVlxh1nPLoATROhkBCkvgo	\N	\N	2026-06-27 14:52:35.44	f	2026-05-28 14:52:35.440547
67fafd7d-e66f-43fa-9601-16a86c1325eb	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk5NjAxNTUsImV4cCI6MTc4MjU1MjE1NX0.rl49DR0_IQMWxfKVsHrVmkVlxh1nPLoATROhkBCkvgo	\N	\N	2026-06-27 14:52:35.441	f	2026-05-28 14:52:35.442176
ddc941db-9348-4acb-98ea-5e8c3f188243	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk5NjAxNTUsImV4cCI6MTc4MjU1MjE1NX0.rl49DR0_IQMWxfKVsHrVmkVlxh1nPLoATROhkBCkvgo	\N	\N	2026-06-27 14:52:35.444	f	2026-05-28 14:52:35.445088
e165eb1f-f308-41cb-8edf-2eb549c1bcb7	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk5NjAxNTUsImV4cCI6MTc4MjU1MjE1NX0.rl49DR0_IQMWxfKVsHrVmkVlxh1nPLoATROhkBCkvgo	\N	\N	2026-06-27 14:52:35.445	f	2026-05-28 14:52:35.445965
838b2c80-f786-40de-9c59-8cfd11b9d22b	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk5NjAxNTcsImV4cCI6MTc4MjU1MjE1N30.Yo6wvZ8k63UOyOZakNW5Jw5bmTZSYS5UC4Nh7RecPak	\N	\N	2026-06-27 14:52:37.326	t	2026-05-28 14:52:37.326498
33681f44-7baa-4015-bebc-8984ef35dec4	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk5NjExNzUsImV4cCI6MTc4MjU1MzE3NX0.UFs1dX606zOoIkJ5M2ZkHJ4RNL8d9Om5ir88Il9q7vw	\N	\N	2026-06-27 15:09:35.303	f	2026-05-28 15:09:35.303658
9cce0072-ff46-4e49-bd6d-b56b8c0c6bf0	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk5NjMyMzEsImV4cCI6MTc4MjU1NTIzMX0.D3FWHVgI63hycr2eiiE3SpOjpvNsyiNi6twZ8uzmyrg	\N	\N	2026-06-27 15:43:51.197	t	2026-05-28 15:43:51.197726
a8477018-aaa9-46fa-a4b8-f86516077474	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk5NjExMjMsImV4cCI6MTc4MjU1MzEyM30.DEXBS5_eRCnCpw4JIXF7LiBX_iVwLHMRKWAoq2guZbs	\N	\N	2026-06-27 15:08:43.149	t	2026-05-28 15:08:43.149761
8d428bf7-4cef-4537-8f54-1f91499f61dc	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk5NjIyODIsImV4cCI6MTc4MjU1NDI4Mn0.Md-rz-lJaR42drMgVMT9OrdM8X_I17PtgB_MJMyw6hk	\N	\N	2026-06-27 15:28:02.115	f	2026-05-28 15:28:02.115709
e2ff64d0-c04c-4833-a48e-0abed700bcbd	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk5NjIyODIsImV4cCI6MTc4MjU1NDI4Mn0.Md-rz-lJaR42drMgVMT9OrdM8X_I17PtgB_MJMyw6hk	\N	\N	2026-06-27 15:28:02.119	f	2026-05-28 15:28:02.119776
782ce063-298b-4e81-a854-a6872fba9fb8	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk5NjIyODIsImV4cCI6MTc4MjU1NDI4Mn0.Md-rz-lJaR42drMgVMT9OrdM8X_I17PtgB_MJMyw6hk	\N	\N	2026-06-27 15:28:02.123	f	2026-05-28 15:28:02.123649
0cd2ad16-46c4-458a-8831-b05851d6df4f	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk5NjIyODIsImV4cCI6MTc4MjU1NDI4Mn0.Md-rz-lJaR42drMgVMT9OrdM8X_I17PtgB_MJMyw6hk	\N	\N	2026-06-27 15:28:02.124	f	2026-05-28 15:28:02.12436
d211b550-b210-41ef-9074-add01d7a0886	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk5NjEyMTUsImV4cCI6MTc4MjU1MzIxNX0.FW85RpCpnPKYlcXWAaNsq1buJVq_52nD_Trv7KIT_bE	\N	\N	2026-06-27 15:10:15.834	t	2026-05-28 15:10:15.8348
b7045ff8-142e-4ef3-88a7-43c9b43ba64a	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk5NjIzMzIsImV4cCI6MTc4MjU1NDMzMn0.UkkLugskW3Avl845Kcy6kXluoZNYX0wKkRoA8vgh27Q	\N	\N	2026-06-27 15:28:52.358	f	2026-05-28 15:28:52.358216
de9fada9-6962-4699-9828-3fc68a6fa834	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk5NjIzMzIsImV4cCI6MTc4MjU1NDMzMn0.UkkLugskW3Avl845Kcy6kXluoZNYX0wKkRoA8vgh27Q	\N	\N	2026-06-27 15:28:52.359	f	2026-05-28 15:28:52.359696
77d3bd4b-1d31-448f-b5b2-eabfc276a4c4	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk5NjIzMzcsImV4cCI6MTc4MjU1NDMzN30.jyCj8lpjMDDYxZC1JO3x_Sfqpqqe54-spmfDM9DtmGU	\N	\N	2026-06-27 15:28:57.679	f	2026-05-28 15:28:57.679325
f934ea2c-a37c-4108-a152-0abf84c3f6cf	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3Nzk5NjI2MDYsImV4cCI6MTc4MjU1NDYwNn0.MBc9-YP2J9SS2pyfP_vAVszLbv7rznCvOsYvxTvVvhc	\N	\N	2026-06-27 15:33:26.222	f	2026-05-28 15:33:26.222293
e5a70e77-6f3b-4b86-9d15-1b0a37f91056	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk5NjI2MzUsImV4cCI6MTc4MjU1NDYzNX0.OKqTj5Q9foNbB8EBlErUA9iG1xw7NSLwEugBwWM6-AM	\N	\N	2026-06-27 15:33:55.513	t	2026-05-28 15:33:55.513603
cc891e69-2d76-4427-8774-1da9de9df874	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk5NjIyODIsImV4cCI6MTc4MjU1NDI4Mn0.Md-rz-lJaR42drMgVMT9OrdM8X_I17PtgB_MJMyw6hk	\N	\N	2026-06-27 15:28:02.111	t	2026-05-28 15:28:02.11321
d968b7c7-57a9-4485-ab85-f2a632d24d4f	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk5NjMyMzEsImV4cCI6MTc4MjU1NTIzMX0.D3FWHVgI63hycr2eiiE3SpOjpvNsyiNi6twZ8uzmyrg	\N	\N	2026-06-27 15:43:51.199	f	2026-05-28 15:43:51.199725
8567279e-b2c0-46bc-a2b8-89af62136166	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk5NjQwNjMsImV4cCI6MTc4MjU1NjA2M30.3YQfgUZsYTNRTmGccebyMm9vWDlfhVgDM4OO55tHCP0	\N	\N	2026-06-27 15:57:43.444	f	2026-05-28 15:57:43.446783
5a913049-bccc-4af0-998c-c3a5a6715b5e	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk5NjQwNjMsImV4cCI6MTc4MjU1NjA2M30.3YQfgUZsYTNRTmGccebyMm9vWDlfhVgDM4OO55tHCP0	\N	\N	2026-06-27 15:57:43.451	f	2026-05-28 15:57:43.452257
aa86552b-d09b-4294-a78b-4830af373412	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk5NjQwNjMsImV4cCI6MTc4MjU1NjA2M30.3YQfgUZsYTNRTmGccebyMm9vWDlfhVgDM4OO55tHCP0	\N	\N	2026-06-27 15:57:43.455	f	2026-05-28 15:57:43.455421
03f34fa8-3ede-47dd-8b6b-e847bbf97853	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk5NjQwNjMsImV4cCI6MTc4MjU1NjA2M30.3YQfgUZsYTNRTmGccebyMm9vWDlfhVgDM4OO55tHCP0	\N	\N	2026-06-27 15:57:43.457	f	2026-05-28 15:57:43.457553
ff386076-82aa-4634-903b-6b4fb32b4b67	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk5NjQwNjMsImV4cCI6MTc4MjU1NjA2M30.3YQfgUZsYTNRTmGccebyMm9vWDlfhVgDM4OO55tHCP0	\N	\N	2026-06-27 15:57:43.458	f	2026-05-28 15:57:43.459016
9c5c1e29-dad7-4a0b-b756-45e5d8e8f59a	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk5NjQwNjMsImV4cCI6MTc4MjU1NjA2M30.3YQfgUZsYTNRTmGccebyMm9vWDlfhVgDM4OO55tHCP0	\N	\N	2026-06-27 15:57:43.46	f	2026-05-28 15:57:43.460309
224efd21-a12e-4739-afa1-aa04588dd4b0	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk5NjQxNjgsImV4cCI6MTc4MjU1NjE2OH0.jInLi9ccUqC8ux-B7A9d6BNQ151xsTjuuEP5lRaWGvE	\N	\N	2026-06-27 15:59:28.448	f	2026-05-28 15:59:28.448678
2faf90c4-2a07-42cd-965e-3cf9bb343daf	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk5NjQxNjgsImV4cCI6MTc4MjU1NjE2OH0.jInLi9ccUqC8ux-B7A9d6BNQ151xsTjuuEP5lRaWGvE	\N	\N	2026-06-27 15:59:28.449	f	2026-05-28 15:59:28.449289
d8fca131-6321-4a74-a70e-2ba30910debe	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3Nzk5NjQxNzAsImV4cCI6MTc4MjU1NjE3MH0.OP2_tRU3xspx0gkZ-hhABFSc_LC44wwLeBeJDC10FRw	\N	\N	2026-06-27 15:59:30.347	f	2026-05-28 15:59:30.347682
dec29d12-a4b0-4794-9263-74eca52377bf	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk5NjYwMDEsImV4cCI6MTc4MjU1ODAwMX0.CvVuItjLUwoQDJpdyUr5H6cZZgfKklx35CVhOjXEp9I	\N	\N	2026-06-27 16:30:01.24	t	2026-05-28 16:30:01.240473
4bea141e-0dfe-42bf-be31-1539cfe4b4a6	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk5NjQxNzMsImV4cCI6MTc4MjU1NjE3M30.f2duacjnyGft-01CB5e8QG9dcI_phj0t2Z0XZNJJsNI	\N	\N	2026-06-27 15:59:33.26	t	2026-05-28 15:59:33.260429
bf5d0096-c059-4bac-aaa7-4a86a63c9d03	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk5NjUwODMsImV4cCI6MTc4MjU1NzA4M30.cWk2G26JQTKkUtgsaoQArhbpf7tnAyC-dT5bdgQxbWw	\N	\N	2026-06-27 16:14:43.803	f	2026-05-28 16:14:43.803269
cf878309-683a-4d51-95a1-dc0e818d1603	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk5NjUwODMsImV4cCI6MTc4MjU1NzA4M30.cWk2G26JQTKkUtgsaoQArhbpf7tnAyC-dT5bdgQxbWw	\N	\N	2026-06-27 16:14:43.804	f	2026-05-28 16:14:43.804555
af58b3b4-6197-43f7-913e-a53cd9699e0c	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk5NjQwNjUsImV4cCI6MTc4MjU1NjA2NX0.-FZCW_wAo3v7oYSLuAo1DTZN1ycCWOH2Zh7GB6PAyqc	\N	\N	2026-06-27 15:57:45.163	t	2026-05-28 15:57:45.16311
7eca8f32-78e0-4b44-83de-891d62e2f011	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk5NjYwMDEsImV4cCI6MTc4MjU1ODAwMX0.CvVuItjLUwoQDJpdyUr5H6cZZgfKklx35CVhOjXEp9I	\N	\N	2026-06-27 16:30:01.243	f	2026-05-28 16:30:01.243654
a7b983ab-5137-4dec-bdb8-138b64c28c63	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk5NjYwMDEsImV4cCI6MTc4MjU1ODAwMX0.CvVuItjLUwoQDJpdyUr5H6cZZgfKklx35CVhOjXEp9I	\N	\N	2026-06-27 16:30:01.244	f	2026-05-28 16:30:01.245137
669378ee-6e68-4a5c-a164-edaa0a88c686	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk5NjYwMDEsImV4cCI6MTc4MjU1ODAwMX0.CvVuItjLUwoQDJpdyUr5H6cZZgfKklx35CVhOjXEp9I	\N	\N	2026-06-27 16:30:01.246	f	2026-05-28 16:30:01.246494
c9a88be7-574d-439e-805b-199384ec727c	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk5NjUxOTQsImV4cCI6MTc4MjU1NzE5NH0.MaGh4LDedciCLLeXd5XcgFa3JGlemrx0qTOZ0iizmCw	\N	\N	2026-06-27 16:16:34.334	t	2026-05-28 16:16:34.334119
4acbc19d-3c37-4431-bba7-4ac521ed9431	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk5NjYwOTUsImV4cCI6MTc4MjU1ODA5NX0.4xE9p343MwBRMxX4zFxUNyFSNEso1g3i8yKvAw4KtJc	\N	\N	2026-06-27 16:31:35.803	f	2026-05-28 16:31:35.804094
6d337ad0-5949-4571-a79d-5b9fbbfbe41b	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk5NjYwOTUsImV4cCI6MTc4MjU1ODA5NX0.4xE9p343MwBRMxX4zFxUNyFSNEso1g3i8yKvAw4KtJc	\N	\N	2026-06-27 16:31:35.805	f	2026-05-28 16:31:35.806046
199727c1-c5ae-430c-bac1-67521c6443fd	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3Nzk5NjYwOTgsImV4cCI6MTc4MjU1ODA5OH0.5ZDPvX2jXvY4qDUnzwnuho2Y0-hCuioLRviH0F9kMlw	\N	\N	2026-06-27 16:31:38.507	f	2026-05-28 16:31:38.507269
cb4665ad-89d3-4e24-9fc3-669a5d1320b6	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk5NjYxMTQsImV4cCI6MTc4MjU1ODExNH0.PRbyKjIih9ZrbL_L7IuMZjE0Wg-P_wpmTVGHzVEZoIk	\N	\N	2026-06-27 16:31:54.539	f	2026-05-28 16:31:54.540121
6a44f442-cd3c-4234-bdb9-9ae7e3d52f88	6e38cbca-9dc0-4b75-98f8-6ebbe508c90d	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2ZTM4Y2JjYS05ZGMwLTRiNzUtOThmOC02ZWJiZTUwOGM5MGQiLCJpYXQiOjE3Nzk5NjY0MTEsImV4cCI6MTc4MjU1ODQxMX0.FcYRWlpt4A4GTgZLZs5HuOJwP5jHue2FmJzcFEOGt9M	\N	\N	2026-06-27 16:36:51.234	f	2026-05-28 16:36:51.234328
da8ce362-d957-41c9-9aaf-18aecab25573	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk5NjY0NDksImV4cCI6MTc4MjU1ODQ0OX0.2_5kd9es-brXhcJ-xyhyEwCoW66UQCsGSVSEs7L78fM	\N	\N	2026-06-27 16:37:29.308	f	2026-05-28 16:37:29.308682
76a802f0-bd70-462e-8ffd-7b792d5ddfe6	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk5NjY1MzgsImV4cCI6MTc4MjU1ODUzOH0.Fu4VYzNAYwnOXSJQl1WhhdcRbNJiG20yB6WuedfMDbI	\N	\N	2026-06-27 16:38:58.047	f	2026-05-28 16:38:58.047858
465f78eb-2f7a-497d-9c74-c012ee575d0a	6e38cbca-9dc0-4b75-98f8-6ebbe508c90d	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2ZTM4Y2JjYS05ZGMwLTRiNzUtOThmOC02ZWJiZTUwOGM5MGQiLCJpYXQiOjE3Nzk5NjY3MzUsImV4cCI6MTc4MjU1ODczNX0.fCvC_yfqlyLHtyW-uy8gLFPVXl8zfI7AHVrxRehYdus	\N	\N	2026-06-27 16:42:15.385	f	2026-05-28 16:42:15.386108
8debe1f5-e527-425c-bf02-109b5e1780b4	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk5NjY3NzAsImV4cCI6MTc4MjU1ODc3MH0.MlKFL6iwLh2Uc0XPOinDevY0m0F1J8dUGEeeZK7Fvag	\N	\N	2026-06-27 16:42:50.311	f	2026-05-28 16:42:50.311648
1dc9fcfd-410f-4cfd-b4b7-1572ac899f49	6e38cbca-9dc0-4b75-98f8-6ebbe508c90d	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2ZTM4Y2JjYS05ZGMwLTRiNzUtOThmOC02ZWJiZTUwOGM5MGQiLCJpYXQiOjE3Nzk5NjcwNjYsImV4cCI6MTc4MjU1OTA2Nn0.ta-dwXxycHnX6Ctf-bcwI9jJpXYwN9g_uD72EkLODEY	\N	\N	2026-06-27 16:47:46.475	f	2026-05-28 16:47:46.475505
fa187c8c-ad05-4925-80d2-4f284181fa8d	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk5NjcwNzIsImV4cCI6MTc4MjU1OTA3Mn0.wSJgqvjPixoqqm47kRfEiECM-8gZc7nMqP1_TPrWttM	\N	\N	2026-06-27 16:47:52.237	f	2026-05-28 16:47:52.237771
29a18c13-f7aa-4773-a3e9-fab58f0029fd	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3Nzk5NjcwNzksImV4cCI6MTc4MjU1OTA3OX0.NaZbcBwlGL6aJgJov-GZIq8D4LDKk9FdyBSYxu6zErc	\N	\N	2026-06-27 16:47:59.391	f	2026-05-28 16:47:59.391303
3b8d4e61-6764-44e8-970f-d019ac4554a3	6e38cbca-9dc0-4b75-98f8-6ebbe508c90d	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2ZTM4Y2JjYS05ZGMwLTRiNzUtOThmOC02ZWJiZTUwOGM5MGQiLCJpYXQiOjE3Nzk5NjcwODUsImV4cCI6MTc4MjU1OTA4NX0.iDcy91x3qseU_Rm8eEvDIZvf1M6eMt7bUjd-mnvqoTA	\N	\N	2026-06-27 16:48:05.271	f	2026-05-28 16:48:05.271996
3b2c30c2-db13-4a70-b0d7-a2e27cd3caac	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3Nzk5NjcwODksImV4cCI6MTc4MjU1OTA4OX0.j8LH8yVNqCkCSGneDXJXfeUF7upvEmNqTHVnS51hjK0	\N	\N	2026-06-27 16:48:09.649	t	2026-05-28 16:48:09.649309
feb1a095-640d-4ad8-bf9b-28b5e876f8cb	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3Nzk5NjgxMTQsImV4cCI6MTc4MjU2MDExNH0.2noYfsMHw6m5XYjPHwb_4aKG_qYScFxuNq4vapQb9YU	\N	\N	2026-06-27 17:05:14.624	f	2026-05-28 17:05:14.625528
27aa22d5-9957-40ed-84ed-c59a93267d3f	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3Nzk5NjgxMTQsImV4cCI6MTc4MjU2MDExNH0.2noYfsMHw6m5XYjPHwb_4aKG_qYScFxuNq4vapQb9YU	\N	\N	2026-06-27 17:05:14.633	f	2026-05-28 17:05:14.68333
f05f77ba-89b3-4e62-96b2-c5e1356e6e4c	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk5Njc2MzMsImV4cCI6MTc4MjU1OTYzM30.MVZC2H1EB2QuQcSTKdN34P8Bc3GS3GXFKEjE7QbTScc	\N	\N	2026-06-27 16:57:13.568	t	2026-05-28 16:57:13.569046
f914e2f7-ef62-40d9-a1b7-d0fb9fae6a68	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3Nzk5Njg2ODAsImV4cCI6MTc4MjU2MDY4MH0.NP13OKICeNrd3-UyT0GuVhsiXEn84hkwAZFQeZKs0lM	\N	\N	2026-06-27 17:14:40.989	t	2026-05-28 17:14:40.989782
95752c04-cb81-411d-8e8d-694be3c620d7	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk5NzEyNTIsImV4cCI6MTc4MjU2MzI1Mn0.YoWIJJMoXlVf6G2Z81P0q5m6bGxzAn-1eocm9WBWm-w	\N	\N	2026-06-27 17:57:32.111	t	2026-05-28 17:57:32.112334
3fdaeb5d-e7bb-46c8-ab04-8c0254099daf	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3Nzk5NzI0OTksImV4cCI6MTc4MjU2NDQ5OX0.celWuV2-qbGt2lgcBHYdUmyjQyNSVGSqQt1NJSWuBjw	\N	\N	2026-06-27 18:18:19.844	t	2026-05-28 18:18:19.844507
2db26c05-f6e8-4ab2-9f97-f16069582e12	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk5NzQ4MjIsImV4cCI6MTc4MjU2NjgyMn0.y_tOvkmnzGODU--EBhbQes3k0hftLO2bpo2BeW9U9qc	\N	\N	2026-06-27 18:57:02.185	t	2026-05-28 18:57:02.185599
ebf7016e-2b46-4a0b-ac1c-b16497e73768	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3Nzk5NzYwNjksImV4cCI6MTc4MjU2ODA2OX0.0Gi2-6BlDnxMzWI5G1R3Kemk4mUvvja6SWceTWhgiMY	\N	\N	2026-06-27 19:17:49.892	t	2026-05-28 19:17:49.892265
b6d3f6ab-ce37-4e07-9a9e-ca98ff16c808	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3Nzk5Nzk1MDcsImV4cCI6MTc4MjU3MTUwN30.tOvcjNTzFl7wYizu0Bv3w_sGcvRIqgUMInxy2g9hEX8	\N	\N	2026-06-27 20:15:07.19	f	2026-05-28 20:15:07.191108
25bc88e5-f4ae-4e86-9aed-5d687adaeaaf	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk5ODA5MjcsImV4cCI6MTc4MjU3MjkyN30.BZVfNonrZ15zlqFFadOwAZ5fITPLkrXkor0mVQmnr-E	\N	\N	2026-06-27 20:38:47.711	t	2026-05-28 20:38:47.712078
aeb61940-34ef-4ed6-8277-36f1dc2e1395	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk5ODQ0OTEsImV4cCI6MTc4MjU3NjQ5MX0.rArgB9aLuqlPjggpgzUpku5ZpYPSvcM6xqi-Lo66zGU	\N	\N	2026-06-27 21:38:11.649	t	2026-05-28 21:38:11.649465
62730f6d-483d-4ba9-a764-46a3fbc3fd18	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk5NzgzOTIsImV4cCI6MTc4MjU3MDM5Mn0.ajWRztFID8Ccy3D5KLAJSlxkE-J64sCw9bqm3XaUqtQ	\N	\N	2026-06-27 19:56:32.241	t	2026-05-28 19:56:32.241886
3d3d81a5-9d8d-4c84-8955-14c20408de25	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk5ODA5MjEsImV4cCI6MTc4MjU3MjkyMX0.ZZyR9wAbtSfSzDNX9S6aYVsFhM5GsJFaIqsnd8tcdHQ	\N	\N	2026-06-27 20:38:41.543	f	2026-05-28 20:38:41.543538
dede2c61-8746-48fe-81cc-c5204ab8a7da	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk5ODA5MjEsImV4cCI6MTc4MjU3MjkyMX0.ZZyR9wAbtSfSzDNX9S6aYVsFhM5GsJFaIqsnd8tcdHQ	\N	\N	2026-06-27 20:38:41.543	f	2026-05-28 20:38:41.543956
93bb4b22-6dcb-4987-af63-8e330beebe00	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk5ODA5MjEsImV4cCI6MTc4MjU3MjkyMX0.ZZyR9wAbtSfSzDNX9S6aYVsFhM5GsJFaIqsnd8tcdHQ	\N	\N	2026-06-27 20:38:41.544	f	2026-05-28 20:38:41.544368
c3e8cdab-1a99-4a63-a66d-13c279c5c793	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk5ODA5MjEsImV4cCI6MTc4MjU3MjkyMX0.ZZyR9wAbtSfSzDNX9S6aYVsFhM5GsJFaIqsnd8tcdHQ	\N	\N	2026-06-27 20:38:41.544	f	2026-05-28 20:38:41.544978
40264413-57d7-44a3-9a88-94843240a8a7	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk5ODA5MjEsImV4cCI6MTc4MjU3MjkyMX0.ZZyR9wAbtSfSzDNX9S6aYVsFhM5GsJFaIqsnd8tcdHQ	\N	\N	2026-06-27 20:38:41.545	f	2026-05-28 20:38:41.545889
f5355630-3cc0-476e-83ba-f3b6d391398e	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk5ODgxOTksImV4cCI6MTc4MjU4MDE5OX0.juC4qsldefw3Wccr4cd990M-Dx33umtl3dPDEukNxfE	\N	\N	2026-06-27 22:39:59.774	t	2026-05-28 22:39:59.774505
7e6421d4-b751-4100-a030-6f9eb5eb1bce	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk5ODk3MTYsImV4cCI6MTc4MjU4MTcxNn0.g8CvZrGrAJeisCFeUD4bqeP3-l9gAk2elS23d_eYyKw	\N	\N	2026-06-27 23:05:16.364	t	2026-05-28 23:05:16.365164
27e61647-1a34-4a70-a1fa-0e3d328a3006	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk5ODk3MTYsImV4cCI6MTc4MjU4MTcxNn0.g8CvZrGrAJeisCFeUD4bqeP3-l9gAk2elS23d_eYyKw	\N	\N	2026-06-27 23:05:16.367	t	2026-05-28 23:05:16.367327
c1f4c02c-f869-40b4-9ae2-dd7c4c0b0ba7	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk5OTA5MzUsImV4cCI6MTc4MjU4MjkzNX0.nzMf50NP4EiFR_d7NwOMLi9SpvzTh5NbTAXQvQe2RA4	\N	\N	2026-06-27 23:25:35.436	f	2026-05-28 23:25:35.436935
12c7221a-eced-4c9d-971b-62b15948951c	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk5OTA5MzUsImV4cCI6MTc4MjU4MjkzNX0.nzMf50NP4EiFR_d7NwOMLi9SpvzTh5NbTAXQvQe2RA4	\N	\N	2026-06-27 23:25:35.437	f	2026-05-28 23:25:35.437477
e5574ae7-f8a0-4e56-950b-ca0d00a263d0	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk5OTA5MzUsImV4cCI6MTc4MjU4MjkzNX0.nzMf50NP4EiFR_d7NwOMLi9SpvzTh5NbTAXQvQe2RA4	\N	\N	2026-06-27 23:25:35.437	f	2026-05-28 23:25:35.437945
bb92f102-5169-41cf-8540-01e701fd5d38	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk5OTA5MzUsImV4cCI6MTc4MjU4MjkzNX0.nzMf50NP4EiFR_d7NwOMLi9SpvzTh5NbTAXQvQe2RA4	\N	\N	2026-06-27 23:25:35.438	f	2026-05-28 23:25:35.43848
c36b6697-cf7d-4e02-ab41-a71fbd99db1b	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk5OTA5MzUsImV4cCI6MTc4MjU4MjkzNX0.nzMf50NP4EiFR_d7NwOMLi9SpvzTh5NbTAXQvQe2RA4	\N	\N	2026-06-27 23:25:35.439	f	2026-05-28 23:25:35.439464
bd70c36c-1bf1-4349-9b7d-a0eabd6be260	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk5OTA5MzUsImV4cCI6MTc4MjU4MjkzNX0.nzMf50NP4EiFR_d7NwOMLi9SpvzTh5NbTAXQvQe2RA4	\N	\N	2026-06-27 23:25:35.441	f	2026-05-28 23:25:35.441897
26b0fb98-252b-440b-af5e-56b02d71bd39	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk5ODk3MTYsImV4cCI6MTc4MjU4MTcxNn0.g8CvZrGrAJeisCFeUD4bqeP3-l9gAk2elS23d_eYyKw	\N	\N	2026-06-27 23:05:16.368	t	2026-05-28 23:05:16.369105
c4d76d44-08d7-41ca-a178-07c4f6aa352c	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk5OTA5MzUsImV4cCI6MTc4MjU4MjkzNX0.nzMf50NP4EiFR_d7NwOMLi9SpvzTh5NbTAXQvQe2RA4	\N	\N	2026-06-27 23:25:35.446	f	2026-05-28 23:25:35.446443
3ee6fd4b-d9cc-4370-a48f-71cca32a8be1	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk5OTEzOTAsImV4cCI6MTc4MjU4MzM5MH0.bKPj_le1xD5_vL5Rw3DiHvMgppDR61cW3q-z-nsAvA4	\N	\N	2026-06-27 23:33:10.978	f	2026-05-28 23:33:10.978523
0bec7c83-3ccb-40f9-89b4-d701bd5eab84	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk5OTE4MTgsImV4cCI6MTc4MjU4MzgxOH0.SqFLumTfe3UDvB3hW3u6bG52HOtNPoRsRZ5regz7ORo	\N	\N	2026-06-27 23:40:18.551	f	2026-05-28 23:40:18.551292
83530664-e169-41b8-824c-23f67f34e4da	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk5OTE4NzUsImV4cCI6MTc4MjU4Mzg3NX0.uheBo91rwC_ut2ZFOKx1PlBv0JOSM7SocG-MKWIZQ8o	\N	\N	2026-06-27 23:41:15.37	f	2026-05-28 23:41:15.372159
124e3579-dcd2-4c22-8a67-415f11395783	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk5OTIxNzUsImV4cCI6MTc4MjU4NDE3NX0.0tuYvIwR7rn4BwK9v-stdKkSR8DdT2zYogZATYMMzvk	\N	\N	2026-06-27 23:46:15.685	f	2026-05-28 23:46:15.685806
db8bf75b-1647-4805-b980-78860de57dfd	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk5OTMwNjUsImV4cCI6MTc4MjU4NTA2NX0._a5zQ5qWGkowpO-h7w2kR4C4U74pT60gQY-8E0Jg2_Q	\N	\N	2026-06-28 00:01:05.196	f	2026-05-29 00:01:05.196195
f0108247-b900-4e96-b775-ab2d0803aea0	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3Nzk5OTMzMzYsImV4cCI6MTc4MjU4NTMzNn0.7sEjV40Ri0_fM7uhUAqToV55pbbwruebXEPOrqUJyUM	\N	\N	2026-06-28 00:05:36.058	f	2026-05-29 00:05:36.058919
a76afdcb-a32b-4463-956b-45ca350740d7	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk5OTM3MjQsImV4cCI6MTc4MjU4NTcyNH0.DqVxun6IvXJpbJccPX3pRnlx3LxLAkmPqcE_T5eFjFA	\N	\N	2026-06-28 00:12:04.747	f	2026-05-29 00:12:04.747928
a13ae878-027c-4abf-b2f3-843bbfc86070	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk5OTM3NzMsImV4cCI6MTc4MjU4NTc3M30.AV9hMarCDPF5D4TGUdoopi7q0HLNHC45YHqxharF3go	\N	\N	2026-06-28 00:12:53.59	f	2026-05-29 00:12:53.590612
d557feb8-d01b-4b30-b78b-fb43129da2a6	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk5OTM4MDQsImV4cCI6MTc4MjU4NTgwNH0.p5fyoEnf-D6a4UHkO_XdW3vtq4dPa-btAko_UFB0QdY	\N	\N	2026-06-28 00:13:24.666	f	2026-05-29 00:13:24.666617
f3303f9a-10b9-4f48-9cdd-07cccce9bf3c	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3Nzk5OTM4MTksImV4cCI6MTc4MjU4NTgxOX0.j6bYdtKQoGT-3yTqbGdMNdPiIextEqMpCmHnQwyBCx0	\N	\N	2026-06-28 00:13:39.171	f	2026-05-29 00:13:39.172047
0177eca7-eea1-4db3-ad48-064609545976	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk5OTQzNTcsImV4cCI6MTc4MjU4NjM1N30.a_EHthri8XjXovB1eykmWZvCJE90ccGIyu8BEaz4_ac	\N	\N	2026-06-28 00:22:37.889	f	2026-05-29 00:22:37.889471
4d52951d-6ffc-4401-a167-d9e6941eaa41	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk5OTQzODksImV4cCI6MTc4MjU4NjM4OX0.Vt1nN9uYrcqgQw_4xBA3U00ZvoLvaCwArIIIQgZ_Dro	\N	\N	2026-06-28 00:23:09.696	f	2026-05-29 00:23:09.696793
9a2eded6-a4bb-4b58-9443-12783bc6105e	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk5OTQ0MTIsImV4cCI6MTc4MjU4NjQxMn0.69EFq-WiVHIswaccLQodhsMKixP7MEWRPKQiNHBv8e8	\N	\N	2026-06-28 00:23:32.95	f	2026-05-29 00:23:32.95027
25f3e87b-8197-4abe-87db-7ad9165e37b8	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3Nzk5OTQ0MTYsImV4cCI6MTc4MjU4NjQxNn0.y04ehsbLZsT8FgRv9socZzrm6J4dTtH_DZ4FnRmbLdM	\N	\N	2026-06-28 00:23:36.434	f	2026-05-29 00:23:36.434935
8333dfd1-be36-4260-9b27-c55d180a2169	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk5OTQ3NDAsImV4cCI6MTc4MjU4Njc0MH0.TlT90NIXX9XFky-6lR3wfc1Xa80TB8FgjW1yiMZFzUg	\N	\N	2026-06-28 00:29:00.493	f	2026-05-29 00:29:00.49364
7d18bc52-10e0-4621-af75-5765f4ba9a9a	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk5OTQ3ODIsImV4cCI6MTc4MjU4Njc4Mn0.se_cCTYUv_F3oqaWYhTmH27Mt6dD6vVBKZVHBhyfkRA	\N	\N	2026-06-28 00:29:42.285	f	2026-05-29 00:29:42.28538
1e3cc9ec-4a1f-4ab1-8790-2a18d70fe894	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3Nzk5OTQ3ODcsImV4cCI6MTc4MjU4Njc4N30.O7dmsXyHHFxzVC1bTQUlk3nCDqLEmq_zwLYPbzuTKlg	\N	\N	2026-06-28 00:29:47.215	f	2026-05-29 00:29:47.215451
d6a4c010-6bc3-4cfb-b610-7f43b693a816	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk5OTU4MDIsImV4cCI6MTc4MjU4NzgwMn0.b4tLEPCSpxWQEVQKk8OeiEIavVqPSjy8yQlamsLBo9I	\N	\N	2026-06-28 00:46:42.62	f	2026-05-29 00:46:42.62118
2017f8eb-60c9-4dea-b10c-a8092dd6e6f9	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk5OTU5MDUsImV4cCI6MTc4MjU4NzkwNX0.lfNv75NIlSjM-eyOWJH6G-CRql_bM5nojAGs2vPo6LE	\N	\N	2026-06-28 00:48:25.47	f	2026-05-29 00:48:25.470548
12bd9275-1e8f-4476-8685-78e1927c6247	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk5OTYxMjcsImV4cCI6MTc4MjU4ODEyN30.N2heJnrxKEo0n2Ac_eOjuNIdYGuJpvQr5eDRCc1evuo	\N	\N	2026-06-28 00:52:07.696	f	2026-05-29 00:52:07.696733
b078700d-1896-43fd-add5-9a0886bf36ec	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk5OTYzMTAsImV4cCI6MTc4MjU4ODMxMH0.og1U-bQhCy1XCNaEg1nIi-PFGNRF2lF232NfHtnz894	\N	\N	2026-06-28 00:55:10.894	f	2026-05-29 00:55:10.894636
c9a4d895-d7cd-46b0-8698-76d9b3c4fc77	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk5OTYzNjEsImV4cCI6MTc4MjU4ODM2MX0.xoOiP_Ewdg05IEngPtrc8hhOJWLXIt5kp9ucaMsYGYc	\N	\N	2026-06-28 00:56:01.105	f	2026-05-29 00:56:01.105288
80f60c6e-6ce1-4843-9ea9-656d3d7722f3	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk5OTY0NTcsImV4cCI6MTc4MjU4ODQ1N30.iH9YHiOhGwMRWgynwS_M3uTmDQuJUssb-7P-8bjOdgs	\N	\N	2026-06-28 00:57:37.371	f	2026-05-29 00:57:37.37176
f7e9b766-df09-4f20-b9e4-6ba1ec9c6f11	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3Nzk5OTY0NjMsImV4cCI6MTc4MjU4ODQ2M30.Psg8cAEIeJYLzpuoeobUTfKm7sXrtr7ngB5aXgpSUtI	\N	\N	2026-06-28 00:57:43.167	f	2026-05-29 00:57:43.168017
94483c45-08c8-48ca-8509-ce115ba75ca2	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3Nzk5OTY1MDAsImV4cCI6MTc4MjU4ODUwMH0.yOAVdPopFkrIlP01Bp6TWJFbDmRttEaayOLCk0UsPNU	\N	\N	2026-06-28 00:58:20.226	f	2026-05-29 00:58:20.226241
b89ea9ed-818b-4966-8052-d54fc29c79b3	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3Nzk5OTY1MzEsImV4cCI6MTc4MjU4ODUzMX0.buqNLcUei1H2JGf72MOVBn9Uhlm7hOoQ8JlHv-FU7AE	\N	\N	2026-06-28 00:58:51.859	f	2026-05-29 00:58:51.860016
3a1f8ea1-9d03-4ba0-a753-05174af59ee6	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk5OTY2NzksImV4cCI6MTc4MjU4ODY3OX0.OBTEKRe-Rt3q4ujrCIpVswCRK671h_5j3kTNsbxGO2o	\N	\N	2026-06-28 01:01:19.322	f	2026-05-29 01:01:19.322831
688620f2-5c14-4280-a020-5b107fea390c	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3Nzk5OTcwNDIsImV4cCI6MTc4MjU4OTA0Mn0.3BJW-BaEY-q50Jc-SmD3E8f01PI6Alnkkpff4C3UZPA	\N	\N	2026-06-28 01:07:22.324	f	2026-05-29 01:07:22.324561
336b6bde-b2a5-4d10-8179-48b1148617dc	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk5OTkxNzgsImV4cCI6MTc4MjU5MTE3OH0.lBgQMnxKLJdoDWlx1jnBSluZcuqqboz_SVmjI7qZO2s	\N	\N	2026-06-28 01:42:58.933	t	2026-05-29 01:42:58.933814
3b608e99-8a2d-4db1-8a6f-4857d450283a	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk5OTcyNTAsImV4cCI6MTc4MjU4OTI1MH0.Hx0jXvnYmDtcCovMWEoXB56sc3eyNecfqnlvSDhSQY4	\N	\N	2026-06-28 01:10:50.637	t	2026-05-29 01:10:50.637332
77b53a44-840a-484d-90b8-4bf9ff78be0b	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk5OTgxODMsImV4cCI6MTc4MjU5MDE4M30.PG_SjUlGS15t2Dsys9rJUCokkcA1ms47haO9QIquMVo	\N	\N	2026-06-28 01:26:23.978	f	2026-05-29 01:26:23.978805
95696a3a-9c1c-4f7e-b917-c2cd82cfc21b	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk5OTgxODMsImV4cCI6MTc4MjU5MDE4M30.PG_SjUlGS15t2Dsys9rJUCokkcA1ms47haO9QIquMVo	\N	\N	2026-06-28 01:26:23.98	f	2026-05-29 01:26:23.980864
0a076137-1365-40ec-a9e4-03e3e92deb4d	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk5OTgxODMsImV4cCI6MTc4MjU5MDE4M30.PG_SjUlGS15t2Dsys9rJUCokkcA1ms47haO9QIquMVo	\N	\N	2026-06-28 01:26:23.982	f	2026-05-29 01:26:23.982562
3d18e999-09b2-482c-80d3-787177eb22fc	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3Nzk5OTgxODYsImV4cCI6MTc4MjU5MDE4Nn0.cVOsp77s6qgmL4l8sSURg7F7ryNYUcn7BJ9qESLQU7g	\N	\N	2026-06-28 01:26:26.351	t	2026-05-29 01:26:26.35187
4168f4a6-edd8-47c5-bc66-555d603f6ddc	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3ODAwMDEzNDUsImV4cCI6MTc4MjU5MzM0NX0.05peKVnCcFX_FFHpDpxsWTAwil4ufVNomQXJ6EKaxO4	\N	\N	2026-06-28 02:19:05.405	f	2026-05-29 02:19:05.405509
623207fc-8d7c-42f9-95e7-873632e7419e	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3ODAwMDEzNDUsImV4cCI6MTc4MjU5MzM0NX0.05peKVnCcFX_FFHpDpxsWTAwil4ufVNomQXJ6EKaxO4	\N	\N	2026-06-28 02:19:05.405	f	2026-05-29 02:19:05.406076
8132e131-9f89-4ae7-ae71-a8cb41013cf2	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3ODAwMDAyNjUsImV4cCI6MTc4MjU5MjI2NX0.0g0XdOAWm-YxRT_E43D1EhFtAPIWdR6ckPqhgOms9co	\N	\N	2026-06-28 02:01:05.618	t	2026-05-29 02:01:05.618887
14bd0ceb-29b4-465a-9926-ec36b9da18d0	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3ODAwMDEzNDUsImV4cCI6MTc4MjU5MzM0NX0.05peKVnCcFX_FFHpDpxsWTAwil4ufVNomQXJ6EKaxO4	\N	\N	2026-06-28 02:19:05.406	f	2026-05-29 02:19:05.406728
858d3420-8de3-44cd-a982-2586cb264255	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3ODAwMDEzNTAsImV4cCI6MTc4MjU5MzM1MH0.AMh4RdE9qBF0ggrqgsP0KyqWpscm7oXPzXBf2VsthLs	\N	\N	2026-06-28 02:19:10.492	f	2026-05-29 02:19:10.492653
4f797e96-b434-4f07-95d3-6c3b6c8246a1	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3ODAwMDEzNjUsImV4cCI6MTc4MjU5MzM2NX0.6IGzDe6aMlsTKMtr8iME8xraNsKMzHP2er6VFmYtpXs	\N	\N	2026-06-28 02:19:25.592	f	2026-05-29 02:19:25.592245
9349b881-cb61-4aea-90ec-6f33125a5f54	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3ODAwMDEzNzcsImV4cCI6MTc4MjU5MzM3N30.FbTbHiIHmB6eEoZmJZgyAVKNEejQQGydd14wOowqCYc	\N	\N	2026-06-28 02:19:37.951	f	2026-05-29 02:19:37.951687
acadb13a-cce3-4b56-baff-b4a0baa64c7e	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3ODAwMDEzOTEsImV4cCI6MTc4MjU5MzM5MX0.mvjkCmGz9e8PvcFIyrWbZHfvuTAXcJVIKwkrrXFiGsQ	\N	\N	2026-06-28 02:19:51.578	f	2026-05-29 02:19:51.57891
dad3643c-728f-4ed9-8ecc-b1613b899914	d263eb62-0c0f-458b-bf31-654549c58655	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJkMjYzZWI2Mi0wYzBmLTQ1OGItYmYzMS02NTQ1NDljNTg2NTUiLCJpYXQiOjE3ODAwMDE1ODAsImV4cCI6MTc4MjU5MzU4MH0.a6bmUpwkf4aZagtQcqv8OtUje7kAnBhxXB4sxRTvoUE	\N	\N	2026-06-28 02:23:00.815	f	2026-05-29 02:23:00.815551
5133419c-053f-4754-ac7f-647116c31407	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3ODAwMDE3MTcsImV4cCI6MTc4MjU5MzcxN30.pykA0sZtrGyZv2JXC-WMkPQqeQb0HX7_CrYXA55FOCc	\N	\N	2026-06-28 02:25:17.185	t	2026-05-29 02:25:17.185362
404190d2-8213-4acc-b95b-78ab9a5fe371	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3ODAwMDU5MjcsImV4cCI6MTc4MjU5NzkyN30.BD3CIAr6W-V7uP5yx5ZYs9xGvQBgUQ-96uub7bNtfbI	\N	\N	2026-06-28 03:35:27.523	t	2026-05-29 03:35:27.523792
20a1eaa5-54a7-44f4-ab2b-e8e44905b30f	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3ODAwMDk0OTcsImV4cCI6MTc4MjYwMTQ5N30.5qF8a4AgrVYkDRUPZZk-3o7iV3lO2tLHwLRqoLH9owk	\N	\N	2026-06-28 04:34:57.631	t	2026-05-29 04:34:57.632235
c1d68648-0952-4b65-a882-6ede4e90bb76	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3ODAwMTMwNjcsImV4cCI6MTc4MjYwNTA2N30.WPI6fSkJxsDFGHetfsnU5jSiVCzK0RmEPdgJFo8BNiE	\N	\N	2026-06-28 05:34:27.718	t	2026-05-29 05:34:27.719392
a0e406e0-8b3a-442e-bb00-221bec225520	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3ODAwMTY2MzcsImV4cCI6MTc4MjYwODYzN30.m3Ml6b68sb4cSO21ZAQed9_SPUE9IEqTbGYYHMY0wZE	\N	\N	2026-06-28 06:33:57.883	t	2026-05-29 06:33:57.883392
1cebd1de-2df1-4d8f-962e-34e876689572	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3ODAwMjAyMDgsImV4cCI6MTc4MjYxMjIwOH0.FwFZvqUhgJfM0dgeea3UbDExV-AygBsF8fV1OZteoKo	\N	\N	2026-06-28 07:33:28.05	t	2026-05-29 07:33:28.05031
7c00ae96-7efa-406e-b750-37faf8d99e75	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3ODAwMjM3NzgsImV4cCI6MTc4MjYxNTc3OH0.tqX5aT3Sg3DzAGHG4k-TLwECbKagpGh3Tr1le0Q433Q	\N	\N	2026-06-28 08:32:58.137	f	2026-05-29 08:32:58.137898
4a448a68-57da-4151-8e56-6b82444f8d71	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3ODAwMjQxOTYsImV4cCI6MTc4MjYxNjE5Nn0.Rrrl0Xx-Y1hy5A6C8bDMK-NmHrIe1wnRQU3sGdELGlE	\N	\N	2026-06-28 08:39:56.581	f	2026-05-29 08:39:56.581881
fec687df-e049-4ba7-b408-fc5079c11af7	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3ODAwMjQ1MDIsImV4cCI6MTc4MjYxNjUwMn0.z4PDeMI0fKQsu7yX0teyJVRYAlcIKoyoHrDo6UCN8F4	\N	\N	2026-06-28 08:45:02.434	f	2026-05-29 08:45:02.434722
79a21afb-6ca1-4005-a0ee-97d55367e069	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3ODAwMjQ4MTAsImV4cCI6MTc4MjYxNjgxMH0.vYu1I_HfY_sSyb8Axice3TcXchXz0bmn5IPjCkdL2xg	\N	\N	2026-06-28 08:50:10.152	f	2026-05-29 08:50:10.15253
149238af-e2a4-4d74-ad0d-8aaac08910fe	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3ODAwMjUwNTgsImV4cCI6MTc4MjYxNzA1OH0.RIpC3-dErgdXkGTI0k1QAMmQshZzf0s2HkBSCLt6TRc	\N	\N	2026-06-28 08:54:18.825	f	2026-05-29 08:54:18.825686
b0214c49-5a99-41d9-b107-2eb5d959e2c7	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3ODAwMjUxOTEsImV4cCI6MTc4MjYxNzE5MX0.ig1PxU39xZ9odkhVjqXOQFeZsJhx1QBqrSf4vsf44YY	\N	\N	2026-06-28 08:56:31.582	f	2026-05-29 08:56:31.582983
dfe8066c-441f-4ab6-b603-12034f1549fa	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3ODAwMjYyNjIsImV4cCI6MTc4MjYxODI2Mn0.3Vbc0PfhZMBR9gXcMGDefnXH_gOnx69a7TErDTRe1zQ	\N	\N	2026-06-28 09:14:22.794	t	2026-05-29 09:14:22.79451
0dd40bad-f42e-45b3-b7d0-ff2883d92baa	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3ODAwMjg3NjEsImV4cCI6MTc4MjYyMDc2MX0.b3grc8zaycM2jpjP5aNUWPyHxoAucNJJWM4NS2NNId4	\N	\N	2026-06-28 09:56:01.737	t	2026-05-29 09:56:01.738028
2a9287f5-6e6e-4bcc-b8db-5d722113a57a	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3ODAwMjk4MzMsImV4cCI6MTc4MjYyMTgzM30.B1fzJM7HvEZL5y4qPb3LDQwlfoELdErkXJ73TjoLJv0	\N	\N	2026-06-28 10:13:53.039	f	2026-05-29 10:13:53.039662
752eeced-eb70-4e19-bc56-5d64fb476d40	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3ODAwMzI3NDYsImV4cCI6MTc4MjYyNDc0Nn0.4yy1aVPZeqSROwjECFWIbt6xWR680dIMk8kzOYu-UhA	\N	\N	2026-06-28 11:02:26.779	f	2026-05-29 11:02:26.783511
8e51aaa5-d571-400b-bace-52989d8d2662	b70d1a34-fc31-4bcf-81b1-af36aeb552ab	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJiNzBkMWEzNC1mYzMxLTRiY2YtODFiMS1hZjM2YWViNTUyYWIiLCJpYXQiOjE3ODAwMzYxNDcsImV4cCI6MTc4MjYyODE0N30.K_F9NToIm8FwzIJaQwsrQaKQeWqVVNqzqDbqm360F3A	\N	\N	2026-06-28 11:59:07.044	f	2026-05-29 11:59:07.044448
499df308-0930-48a6-9333-683f949b2a5c	b70d1a34-fc31-4bcf-81b1-af36aeb552ab	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJiNzBkMWEzNC1mYzMxLTRiY2YtODFiMS1hZjM2YWViNTUyYWIiLCJpYXQiOjE3ODAwMzcxMzYsImV4cCI6MTc4MjYyOTEzNn0.DppVbNHggmaOKMNpMJ8GakxtV0LWxrQcHA7DToQcQ7s	\N	\N	2026-06-28 12:15:36.265	f	2026-05-29 12:15:36.265534
8b5c060d-3963-4767-9c84-041520cd075f	3d074d19-5d5d-46fa-b43c-9f1c9f257983	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIzZDA3NGQxOS01ZDVkLTQ2ZmEtYjQzYy05ZjFjOWYyNTc5ODMiLCJpYXQiOjE3ODAwMzc0MTcsImV4cCI6MTc4MjYyOTQxN30.Vh6P2AapH6_GL9qfeWP972qO4-AYzPYrtYP-HLoXxgY	\N	\N	2026-06-28 12:20:17.759	f	2026-05-29 12:20:17.759335
abab1bcb-bed6-43f4-b4f7-85de039ba441	b2b8e045-2b56-46a6-ac1e-77b19b4ba586	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJiMmI4ZTA0NS0yYjU2LTQ2YTYtYWMxZS03N2IxOWI0YmE1ODYiLCJpYXQiOjE3ODAwMzc1MTQsImV4cCI6MTc4MjYyOTUxNH0.YHTW04HP4jOSUl39g0Bon7Z0C3qBRzeOV-ChXkkizBc	\N	\N	2026-06-28 12:21:54.996	f	2026-05-29 12:21:54.996595
862b5f09-724d-4010-93f0-7a3ddcfbc8ae	b70d1a34-fc31-4bcf-81b1-af36aeb552ab	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJiNzBkMWEzNC1mYzMxLTRiY2YtODFiMS1hZjM2YWViNTUyYWIiLCJpYXQiOjE3ODAwMzg2MjIsImV4cCI6MTc4MjYzMDYyMn0.N30-erIiEOHpb_CyBTvZSZg2DWRgymFzOKLzex2vyjM	\N	\N	2026-06-28 12:40:22.797	f	2026-05-29 12:40:22.797731
18bbf2b7-ea2e-48f2-8eac-a3aa1d1922e5	3d074d19-5d5d-46fa-b43c-9f1c9f257983	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIzZDA3NGQxOS01ZDVkLTQ2ZmEtYjQzYy05ZjFjOWYyNTc5ODMiLCJpYXQiOjE3ODAwMzg2MzcsImV4cCI6MTc4MjYzMDYzN30.o_01mHIaJhdbkQaaxOhPmR6s1MJzbKPCIuyzhDVPLsg	\N	\N	2026-06-28 12:40:37.869	f	2026-05-29 12:40:37.869605
df7da397-2d83-4846-8ff9-f489a8c54a18	b2b8e045-2b56-46a6-ac1e-77b19b4ba586	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJiMmI4ZTA0NS0yYjU2LTQ2YTYtYWMxZS03N2IxOWI0YmE1ODYiLCJpYXQiOjE3ODAwMzg3NTUsImV4cCI6MTc4MjYzMDc1NX0.dZnntn8eTq-wLh9lZTpfnRbcoxhkOYierqiRySDI4Ws	\N	\N	2026-06-28 12:42:35.159	f	2026-05-29 12:42:35.159466
7f24761a-a386-4fc3-9d28-08d8eea58d20	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3ODAwNDUwMTUsImV4cCI6MTc4MjYzNzAxNX0.HHNY_GEpyQBTYq9C7tCah8r6ZswdTfqKx8u8hb9Gm68	\N	\N	2026-06-28 14:26:55.155	t	2026-05-29 14:26:55.155552
cd240f3a-4f9c-4a9a-aafe-e7b31a55a953	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3ODAwNDExMzUsImV4cCI6MTc4MjYzMzEzNX0.Q44siEG2aX7563vsnTH7sYFgp_QQKECJWlfQ_gKen6w	\N	\N	2026-06-28 13:22:15.671	t	2026-05-29 13:22:15.671954
c66f836f-e77c-4a41-8027-b51bb887e46d	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3ODAwNDQwMjUsImV4cCI6MTc4MjYzNjAyNX0.QAoGtvG7g68dgdz39Uf8oq75yysGD9MXsB65CWiUI-A	\N	\N	2026-06-28 14:10:25.967	f	2026-05-29 14:10:25.967642
2e671985-2aca-458b-b257-e4195bcf05a9	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3ODAwNDQwMjUsImV4cCI6MTc4MjYzNjAyNX0.QAoGtvG7g68dgdz39Uf8oq75yysGD9MXsB65CWiUI-A	\N	\N	2026-06-28 14:10:25.968	f	2026-05-29 14:10:25.96846
c4ac4302-122d-4e6a-9631-7cff3c4a652e	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3ODAwNDQwMjUsImV4cCI6MTc4MjYzNjAyNX0.QAoGtvG7g68dgdz39Uf8oq75yysGD9MXsB65CWiUI-A	\N	\N	2026-06-28 14:10:25.97	f	2026-05-29 14:10:25.970369
af62a54f-247e-444a-b59d-7e2ed460d002	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3ODAwNDQwMjUsImV4cCI6MTc4MjYzNjAyNX0.QAoGtvG7g68dgdz39Uf8oq75yysGD9MXsB65CWiUI-A	\N	\N	2026-06-28 14:10:25.97	f	2026-05-29 14:10:25.97089
fadfa50f-d85a-4979-bc69-5031a952b24e	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3ODAwNDQxMTMsImV4cCI6MTc4MjYzNjExM30.llbOwxd33dkd858A898s-mr8TxN5_N8g6-QZehQB80s	\N	\N	2026-06-28 14:11:53.549	t	2026-05-29 14:11:53.549949
1f271bb3-2ca6-4458-9a3e-58d93e963235	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3ODAwNDUwMTUsImV4cCI6MTc4MjYzNzAxNX0.HHNY_GEpyQBTYq9C7tCah8r6ZswdTfqKx8u8hb9Gm68	\N	\N	2026-06-28 14:26:55.156	f	2026-05-29 14:26:55.156269
125dc432-66e0-4b99-ac9a-22a33d0f15b3	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3ODAwNDUwMTUsImV4cCI6MTc4MjYzNzAxNX0.HHNY_GEpyQBTYq9C7tCah8r6ZswdTfqKx8u8hb9Gm68	\N	\N	2026-06-28 14:26:55.156	f	2026-05-29 14:26:55.157109
3a09f2e5-50b9-4cf9-9b62-6ddba950217a	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3ODAwNDUwMTUsImV4cCI6MTc4MjYzNzAxNX0.HHNY_GEpyQBTYq9C7tCah8r6ZswdTfqKx8u8hb9Gm68	\N	\N	2026-06-28 14:26:55.157	f	2026-05-29 14:26:55.157888
bd318baa-1ca6-407e-9caa-6298c28f8ed5	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3ODAwNDUwMTUsImV4cCI6MTc4MjYzNzAxNX0.HHNY_GEpyQBTYq9C7tCah8r6ZswdTfqKx8u8hb9Gm68	\N	\N	2026-06-28 14:26:55.159	f	2026-05-29 14:26:55.159638
58f51b1e-3b26-4034-b2c6-3613dc4e1910	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3ODAwNDUwMTUsImV4cCI6MTc4MjYzNzAxNX0.HHNY_GEpyQBTYq9C7tCah8r6ZswdTfqKx8u8hb9Gm68	\N	\N	2026-06-28 14:26:55.16	f	2026-05-29 14:26:55.160652
94b3974c-d353-4b4f-bc86-3421b32fa676	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3ODAwNDUwMTUsImV4cCI6MTc4MjYzNzAxNX0.HHNY_GEpyQBTYq9C7tCah8r6ZswdTfqKx8u8hb9Gm68	\N	\N	2026-06-28 14:26:55.174	f	2026-05-29 14:26:55.174847
2de7daaa-5464-4621-b51b-5e2ed6f7ab95	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3ODAwNDUwMTcsImV4cCI6MTc4MjYzNzAxN30.gP9y77ivACT-qde05ZxLgLUW8XszL3XQp1pODkx9ai8	\N	\N	2026-06-28 14:26:57.305	f	2026-05-29 14:26:57.305303
c9c764da-714e-4d30-8de6-afb91f955783	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3ODAwNDU5MTIsImV4cCI6MTc4MjYzNzkxMn0.Sl6rQvLDDGoHAc85c-rermSNPzMPjK8rHAx61wiSn9c	\N	\N	2026-06-28 14:41:52.364	f	2026-05-29 14:41:52.364516
e7e6f197-95ab-4f24-9e61-13386921345f	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3ODAwNDU5NTMsImV4cCI6MTc4MjYzNzk1M30.gtJrtuCWM9q8idjNaRExZPsKaePu2IOdTNIAiJXs2Tw	\N	\N	2026-06-28 14:42:33.22	f	2026-05-29 14:42:33.220355
ea732f8e-c5a3-4485-8105-6e7504f213b2	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3ODAwNDU5NjcsImV4cCI6MTc4MjYzNzk2N30.aNgKtcF5wPTPc3CVaq8hofgN2rtyLV0Tlh97TVBu2g4	\N	\N	2026-06-28 14:42:47.185	f	2026-05-29 14:42:47.18548
b2527c91-d7b5-4bb2-bbe8-27022c33c4cd	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3ODAwNDU5OTIsImV4cCI6MTc4MjYzNzk5Mn0.7j0X_6Wg8bycjTxc15gAad1O4bFTGwzL3qEviVlvElQ	\N	\N	2026-06-28 14:43:12.761	f	2026-05-29 14:43:12.761556
1a15ea43-a4fd-45b3-a7bb-8dbbcccceea9	6e38cbca-9dc0-4b75-98f8-6ebbe508c90d	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2ZTM4Y2JjYS05ZGMwLTRiNzUtOThmOC02ZWJiZTUwOGM5MGQiLCJpYXQiOjE3ODAwNDYwMzgsImV4cCI6MTc4MjYzODAzOH0.efmPt-gUC8xsM9JfYLgAkFgJ9rBmecAw4CKMFO2dS5M	\N	\N	2026-06-28 14:43:58.076	f	2026-05-29 14:43:58.076313
a8dc1dd4-60c3-4b72-a91d-a06f4d584c43	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3ODAwNDYzMzYsImV4cCI6MTc4MjYzODMzNn0.QntcrvWmjEQf8IaafjI4PzUhAECzBghU7FC__MJviiY	\N	\N	2026-06-28 14:48:56.9	f	2026-05-29 14:48:56.900725
8c7048f9-7956-4ec3-a31a-ccb4838c68c1	6e38cbca-9dc0-4b75-98f8-6ebbe508c90d	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2ZTM4Y2JjYS05ZGMwLTRiNzUtOThmOC02ZWJiZTUwOGM5MGQiLCJpYXQiOjE3ODAwNDYzOTMsImV4cCI6MTc4MjYzODM5M30.6DqC9tMsaHjRVFvZSj4NH8AG2LwAHHPhTRvG7LqAj4s	\N	\N	2026-06-28 14:49:53.234	f	2026-05-29 14:49:53.234938
17224d9b-a7a0-40a6-bfa8-0dd58201ccc5	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3ODAwNDY3MTIsImV4cCI6MTc4MjYzODcxMn0.voc2-2Q3DBJ_RHJ8oAiO_bqVPHRIik73ZHJ0mLO0C5U	\N	\N	2026-06-28 14:55:12.729	f	2026-05-29 14:55:12.730212
597ff4cd-bab0-45b0-80ca-57e2dc1239c8	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3ODAwNDY3MTYsImV4cCI6MTc4MjYzODcxNn0.jsEDGJHeAAN4GETLXqq4YyWVQr-XpYHz7nlncWKIWuw	\N	\N	2026-06-28 14:55:16.09	f	2026-05-29 14:55:16.090955
a51ef9da-4f65-43bc-b23f-37844d14001c	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3ODAwNDY3MjAsImV4cCI6MTc4MjYzODcyMH0._pjUdGK7e7f2OuXGy5wq7DzqZ1smb0vCHpqhYGFMhAU	\N	\N	2026-06-28 14:55:20.984	f	2026-05-29 14:55:20.984377
4ad8f715-f885-4f52-98ab-843f790f3ab6	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3ODAwNDY3NDMsImV4cCI6MTc4MjYzODc0M30.l5GGTKb08f6zoIHBgqcSJGzUa0ripGQyVq0ut7xt45Q	\N	\N	2026-06-28 14:55:43.191	f	2026-05-29 14:55:43.191592
8364ffe4-71a1-4da5-a7e6-863a17833edb	6e38cbca-9dc0-4b75-98f8-6ebbe508c90d	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2ZTM4Y2JjYS05ZGMwLTRiNzUtOThmOC02ZWJiZTUwOGM5MGQiLCJpYXQiOjE3ODAwNDY3NDgsImV4cCI6MTc4MjYzODc0OH0.G6iROJt7uMzIKW8Rxhp_UqhguyE7p2-KAEgMukH11yo	\N	\N	2026-06-28 14:55:48.2	f	2026-05-29 14:55:48.2002
f3d8eab2-4405-4735-99e0-c85728905cc5	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3ODAwNDY4MDEsImV4cCI6MTc4MjYzODgwMX0.hi-Vb7Cg9xey5OraEfIRfYHHGOadCWATgKhVYRpsWw4	\N	\N	2026-06-28 14:56:41.277	f	2026-05-29 14:56:41.277495
0790d5ea-f2e0-4cfb-a37b-db445cc490b3	6e38cbca-9dc0-4b75-98f8-6ebbe508c90d	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2ZTM4Y2JjYS05ZGMwLTRiNzUtOThmOC02ZWJiZTUwOGM5MGQiLCJpYXQiOjE3ODAwNDcyMTMsImV4cCI6MTc4MjYzOTIxM30.JulMEdj3wKTBSytwUGfpnFbcHqFkRAapG9AD1SNjgDA	\N	\N	2026-06-28 15:03:33.311	f	2026-05-29 15:03:33.311504
e780a339-c59c-48e9-a317-0ba0da1fa0f5	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3ODAwNDcyNjgsImV4cCI6MTc4MjYzOTI2OH0.z6Y1wpGcGDasB69PtDmL1dDZJ2OOqIrKbxfDwSOMYr4	\N	\N	2026-06-28 15:04:28.129	f	2026-05-29 15:04:28.129533
015cabc9-db01-45f4-a81c-0feea60da17b	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3ODAwNDcyNzUsImV4cCI6MTc4MjYzOTI3NX0.bOmmVIK3ljYz02-uGqGoic4BsEA_Fnw4wICUArafXwc	\N	\N	2026-06-28 15:04:35.744	f	2026-05-29 15:04:35.744811
48eb51af-8146-4fbc-8d45-ddbd9293f3a0	6e38cbca-9dc0-4b75-98f8-6ebbe508c90d	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2ZTM4Y2JjYS05ZGMwLTRiNzUtOThmOC02ZWJiZTUwOGM5MGQiLCJpYXQiOjE3ODAwNDc0NTQsImV4cCI6MTc4MjYzOTQ1NH0.fHK-twIB-G0GJeY1-2EpGxw508SC-hQEgoutdYNBTUQ	\N	\N	2026-06-28 15:07:34.06	f	2026-05-29 15:07:34.060731
68b2e5d4-bfad-4a95-96c2-af9cf08e5904	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3ODAwNDc3MjUsImV4cCI6MTc4MjYzOTcyNX0.IsFgG9WdY_L-oNR3Iy7yrLgFamiOTJGhiR1DJMUVr3M	\N	\N	2026-06-28 15:12:05.396	f	2026-05-29 15:12:05.397216
f732a6e4-50d6-4bb6-9566-913b86bc599f	6e38cbca-9dc0-4b75-98f8-6ebbe508c90d	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2ZTM4Y2JjYS05ZGMwLTRiNzUtOThmOC02ZWJiZTUwOGM5MGQiLCJpYXQiOjE3ODAwNDgwMzEsImV4cCI6MTc4MjY0MDAzMX0.v5QSu4ifrAVEyniy0ouD39X5iq4YIyxjb-Qq2A2yp2k	\N	\N	2026-06-28 15:17:11.787	f	2026-05-29 15:17:11.787871
de12777c-e4fe-4ed6-89b1-81f6418f89bf	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3ODAwNDgwNTksImV4cCI6MTc4MjY0MDA1OX0.8FlewzycRdoJTU_RTEdQJeAKhC_maXbNTKCqKxtrlAc	\N	\N	2026-06-28 15:17:39.921	f	2026-05-29 15:17:39.921943
5105b6b2-000a-4e1c-84d0-09ef8e029540	6e38cbca-9dc0-4b75-98f8-6ebbe508c90d	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2ZTM4Y2JjYS05ZGMwLTRiNzUtOThmOC02ZWJiZTUwOGM5MGQiLCJpYXQiOjE3ODAwNDgxNzEsImV4cCI6MTc4MjY0MDE3MX0.KrCdwqtiz6GiiRdorq5j-Vr8KMu1DjE5M8U-1iLjGWc	\N	\N	2026-06-28 15:19:31.285	f	2026-05-29 15:19:31.28543
f94a8423-0c98-40cb-9a55-3f8a7f1e6e34	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3ODAwNTAwMDksImV4cCI6MTc4MjY0MjAwOX0.LE75YaEyqgxi-S95_JHLGpo9c3wZcPl7MrUYidyrpwc	\N	\N	2026-06-28 15:50:09.373	f	2026-05-29 15:50:09.373433
506ae8cf-d179-4ac6-a8b5-c298af4e826b	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3ODAwNTAwMDksImV4cCI6MTc4MjY0MjAwOX0.LE75YaEyqgxi-S95_JHLGpo9c3wZcPl7MrUYidyrpwc	\N	\N	2026-06-28 15:50:09.373	f	2026-05-29 15:50:09.373981
f9935255-8996-435e-8978-71d1109de891	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3ODAwNDgyODgsImV4cCI6MTc4MjY0MDI4OH0.unmsneo4kXHGuHtbE3NrmdEGLH6maAgUf3PWdKY7sPk	\N	\N	2026-06-28 15:21:28.357	t	2026-05-29 15:21:28.357513
f2a499b6-5665-4c29-8ed7-27c94e32b958	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3ODAwNTAwMDksImV4cCI6MTc4MjY0MjAwOX0.LE75YaEyqgxi-S95_JHLGpo9c3wZcPl7MrUYidyrpwc	\N	\N	2026-06-28 15:50:09.374	f	2026-05-29 15:50:09.37447
08fd6213-5279-42f7-a246-6d67af5bfaf0	6e38cbca-9dc0-4b75-98f8-6ebbe508c90d	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2ZTM4Y2JjYS05ZGMwLTRiNzUtOThmOC02ZWJiZTUwOGM5MGQiLCJpYXQiOjE3ODAwNTAwMTEsImV4cCI6MTc4MjY0MjAxMX0.An1wLQaGIoAUcSEk5sHTb44rSCpiRBxieNXJxuRQdtw	\N	\N	2026-06-28 15:50:11.391	f	2026-05-29 15:50:11.392048
aefcfa3e-7627-4b16-b236-efb236649e47	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3ODAwNTAwNDUsImV4cCI6MTc4MjY0MjA0NX0.hF2V2xZYSDpx8mjzrPGB1XTyYG7F9f7Q6qZELHrwu4Y	\N	\N	2026-06-28 15:50:45.076	f	2026-05-29 15:50:45.076633
4785c031-1802-4cf7-952c-69e464aedcb3	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3ODAwNTA0OTEsImV4cCI6MTc4MjY0MjQ5MX0.nhyeHT-fkoZ1IyyQwpDWMZlsiE_O-g5X9tPXmEOHmiA	\N	\N	2026-06-28 15:58:11.839	f	2026-05-29 15:58:11.839663
080f4881-becd-4581-a058-9cd80169a791	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3ODAwNTA1MDEsImV4cCI6MTc4MjY0MjUwMX0.SapuFUKp3H4CCztTEOHu4ZA8E5g5ZA_NBsstYXFWxa8	\N	\N	2026-06-28 15:58:21.288	f	2026-05-29 15:58:21.288884
1ce2dd4c-8440-402d-ad07-8147fa07f34b	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3ODAwNTA3MzYsImV4cCI6MTc4MjY0MjczNn0.lnWasGCRKx6ulqgdKEjwOKFejaKYMmKghotPwHt5BGc	\N	\N	2026-06-28 16:02:16.717	f	2026-05-29 16:02:16.717381
947abca8-2845-4df8-8c3e-b3eaa82f7f7c	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3ODAwNTA3NjQsImV4cCI6MTc4MjY0Mjc2NH0.GQiDqXTvUdPLmwugbHyCm8vQfU7loYdubLxWboENo-U	\N	\N	2026-06-28 16:02:44.192	t	2026-05-29 16:02:44.19227
e0f6f89b-718b-4023-b628-1d158992816f	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3ODAwNTE2NjUsImV4cCI6MTc4MjY0MzY2NX0.L8NcODeXFz5IrmQwy0cWLUNLFygceXOXdtKE9vb1pcM	\N	\N	2026-06-28 16:17:45.137	f	2026-05-29 16:17:45.138109
c2329b96-9c58-4035-b793-3851d6ac7ac2	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3ODAwNTE2ODMsImV4cCI6MTc4MjY0MzY4M30.ijXi2m6SkR1535J1cL6uA-wg0f-dBB8xkjGaHAJAHOo	\N	\N	2026-06-28 16:18:03.067	f	2026-05-29 16:18:03.067985
5590481b-9524-4643-9448-92fbfbd3eec8	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3ODAwNTE2OTUsImV4cCI6MTc4MjY0MzY5NX0.kMxNukGJWe9542ixDaq6GdWnMpwi7W4b7vg2icK90pw	\N	\N	2026-06-28 16:18:15.273	f	2026-05-29 16:18:15.274216
0a97d9d5-8ecf-4971-9cdf-0ad36ddf3617	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3ODAwNTE3MDksImV4cCI6MTc4MjY0MzcwOX0.r6xq5XBF457U1iBQKeLGrZi3IqUbfd184fIcz6m6ZOM	\N	\N	2026-06-28 16:18:29.704	t	2026-05-29 16:18:29.705036
23ab5d55-197d-4a58-b6b1-81f45c38ef14	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3ODAwNTI2MzEsImV4cCI6MTc4MjY0NDYzMX0.dsocGn2tNNeBT1iWH3ifXjoB1Jwha__qDaeM_sKLoZA	\N	\N	2026-06-28 16:33:51.89	f	2026-05-29 16:33:51.890384
543da54e-e556-4404-bcfc-7f4960b14ed2	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3ODAwNTI2MzEsImV4cCI6MTc4MjY0NDYzMX0.dsocGn2tNNeBT1iWH3ifXjoB1Jwha__qDaeM_sKLoZA	\N	\N	2026-06-28 16:33:51.891	f	2026-05-29 16:33:51.891223
065388fa-84cb-4672-a03a-fd8df127118c	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3ODAwNTI2MzEsImV4cCI6MTc4MjY0NDYzMX0.dsocGn2tNNeBT1iWH3ifXjoB1Jwha__qDaeM_sKLoZA	\N	\N	2026-06-28 16:33:51.891	f	2026-05-29 16:33:51.89206
889e98d4-27e9-4da0-86be-d861012b216f	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3ODAwNTI2MzEsImV4cCI6MTc4MjY0NDYzMX0.dsocGn2tNNeBT1iWH3ifXjoB1Jwha__qDaeM_sKLoZA	\N	\N	2026-06-28 16:33:51.892	f	2026-05-29 16:33:51.892805
cf9286d0-30e9-40ae-bc0f-fef30c1b3fd2	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3ODAwNTI2MzEsImV4cCI6MTc4MjY0NDYzMX0.dsocGn2tNNeBT1iWH3ifXjoB1Jwha__qDaeM_sKLoZA	\N	\N	2026-06-28 16:33:51.893	f	2026-05-29 16:33:51.89392
e45c71ee-ad71-4db0-8835-18c75f19dd4e	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3ODAwNTI2MzEsImV4cCI6MTc4MjY0NDYzMX0.dsocGn2tNNeBT1iWH3ifXjoB1Jwha__qDaeM_sKLoZA	\N	\N	2026-06-28 16:33:51.894	f	2026-05-29 16:33:51.894578
c650e107-0a46-475c-acc4-29139d188f77	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3ODAwNTI2MzMsImV4cCI6MTc4MjY0NDYzM30.7rLlzX3UWHjw_UW0dZX3lC74nN8krfSQS959vo7kJD4	\N	\N	2026-06-28 16:33:53.763	f	2026-05-29 16:33:53.76358
6203b373-d2b9-4937-a389-2ad8ade4dc56	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3ODAwNTMxMjAsImV4cCI6MTc4MjY0NTEyMH0.xaZSl7RgRjAGZdJglJ3NKNHEhsadAFBFU40PfVjuNIA	\N	\N	2026-06-28 16:42:00.243	f	2026-05-29 16:42:00.243182
b76e1e96-b3a7-4448-937c-05f569bd319a	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3ODAwNTMzOTYsImV4cCI6MTc4MjY0NTM5Nn0.3IYFAsuaoMbprK7Kz_a3uNmfrmaWIkKbofMjekzkQos	\N	\N	2026-06-28 16:46:36.206	f	2026-05-29 16:46:36.206932
3d415f59-c178-4fd7-8055-b201d8541e1d	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3ODAwNTM0MDcsImV4cCI6MTc4MjY0NTQwN30.Rzzh7Bk4IPEvZqdvT1W8tHqU94kdKtYh1ihminYO0xc	\N	\N	2026-06-28 16:46:47.599	f	2026-05-29 16:46:47.599343
072e6a94-11b9-4822-9de6-3a338013a407	6e38cbca-9dc0-4b75-98f8-6ebbe508c90d	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2ZTM4Y2JjYS05ZGMwLTRiNzUtOThmOC02ZWJiZTUwOGM5MGQiLCJpYXQiOjE3ODAwNTM0MTQsImV4cCI6MTc4MjY0NTQxNH0.2E7T1a_V3RZ13iQKbC8rkavFNAxuUpkxWOhkq3UsN_o	\N	\N	2026-06-28 16:46:54.768	f	2026-05-29 16:46:54.768562
7ac129ea-5d73-4f48-ae45-e11c422ed0bd	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3ODAwNTM0NTYsImV4cCI6MTc4MjY0NTQ1Nn0.SmCD5Dy0tyf5n2-r_Xqc_zHm4xHYIqJez52AcK7SHUg	\N	\N	2026-06-28 16:47:36.97	f	2026-05-29 16:47:36.970875
7fbafa99-b0a2-4592-a21d-2deaccee9d8a	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3ODAwNTM1NzEsImV4cCI6MTc4MjY0NTU3MX0.d-aFt_gkOT7k6GTA2AueLYJjrSLvHZMNCuphtaLpeWo	\N	\N	2026-06-28 16:49:31.217	f	2026-05-29 16:49:31.217741
8da6ea78-931f-4585-a46c-97a72c0fea5f	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3ODAwNTM1ODgsImV4cCI6MTc4MjY0NTU4OH0.u89Lh-q_p7bm58bW1UyrgfSjQRPmm5jSnSNZ3WwkoAM	\N	\N	2026-06-28 16:49:48.054	f	2026-05-29 16:49:48.055136
9e9be308-9f4e-4d78-bd4e-cbef94f6d43a	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3ODAwNTQzMzksImV4cCI6MTc4MjY0NjMzOX0.exAqLzDOuVGcb9a6Aeouczse2y7E6wjDMjfAqBrD0A0	\N	\N	2026-06-28 17:02:19.186	f	2026-05-29 17:02:19.186832
92c02779-77e3-4651-bfcf-4b40abaed684	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3ODAwNTQ1OTQsImV4cCI6MTc4MjY0NjU5NH0.oExzU9Jd4eTQRxnk6Nt4IPn86rQ0VMGhpr68G7FZfVU	\N	\N	2026-06-28 17:06:34.041	t	2026-05-29 17:06:34.041449
0707eb21-8b1b-4ac4-b435-4e20f9954d62	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3ODAwNTU2MjQsImV4cCI6MTc4MjY0NzYyNH0.bGpuN_1vP5C9S9d61MfPp-xz7m2rE85O2ksWgzoKWRA	\N	\N	2026-06-28 17:23:44.136	f	2026-05-29 17:23:44.136894
5711dc3b-376e-42bd-9682-bec853b3d1c4	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3ODAwNTU2MjQsImV4cCI6MTc4MjY0NzYyNH0.bGpuN_1vP5C9S9d61MfPp-xz7m2rE85O2ksWgzoKWRA	\N	\N	2026-06-28 17:23:44.134	t	2026-05-29 17:23:44.13532
a4a6970e-ccfc-4e6b-8fc1-0c2d9ee39265	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3ODAwNTk1MTEsImV4cCI6MTc4MjY1MTUxMX0.tw8g6jgiczjEdAmAmkKPwJNam7B3KTAs2R5vfYJw1UQ	\N	\N	2026-06-28 18:28:31.922	f	2026-05-29 18:28:31.922277
299489f8-d4f6-4b44-94bb-aa7dac20f8cd	6e38cbca-9dc0-4b75-98f8-6ebbe508c90d	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2ZTM4Y2JjYS05ZGMwLTRiNzUtOThmOC02ZWJiZTUwOGM5MGQiLCJpYXQiOjE3ODAwNTk1MTIsImV4cCI6MTc4MjY1MTUxMn0.qHr9ro9TuywiJFKy1NjDccXhl0-kRxzq7F6_ElQ5WYk	\N	\N	2026-06-28 18:28:32.019	f	2026-05-29 18:28:32.019381
4da483f2-b1d9-47ca-a9dc-5b03845e8668	866bc022-307f-4218-94a3-7622dd2aec79	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NjZiYzAyMi0zMDdmLTQyMTgtOTRhMy03NjIyZGQyYWVjNzkiLCJpYXQiOjE3ODAwNTk1MTIsImV4cCI6MTc4MjY1MTUxMn0.4PvFmHZ4lqLDPu8kEgadT1HRg3vsWDNVebLUyX2GR3g	\N	\N	2026-06-28 18:28:32.105	f	2026-05-29 18:28:32.105223
cdbb2888-367a-4ce2-884c-6abb72a8a8f0	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3ODAwNTk3MjMsImV4cCI6MTc4MjY1MTcyM30.XIJ9b3P4uIkF_eZpFoCtE1rBYQXaqL-w9h8EbRAtPDM	\N	\N	2026-06-28 18:32:03.469	f	2026-05-29 18:32:03.469373
7be3cb93-572c-4831-8c91-2691329405e1	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3ODAwNTk3MzgsImV4cCI6MTc4MjY1MTczOH0.U_us2GqY-6bbuykLha4CMDQgt4BAa3GBgY-wW7npoZE	\N	\N	2026-06-28 18:32:18.384	f	2026-05-29 18:32:18.384247
9dc6bfea-7ddb-4b69-8d77-ce04ef374efa	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3ODAwNTg0NzcsImV4cCI6MTc4MjY1MDQ3N30.6Z78FBEQOpOfGaedcwwKkypAQpjD3ZjYTFm75a69RgE	\N	\N	2026-06-28 18:11:17.035	t	2026-05-29 18:11:17.036103
8d01c713-9c12-47f7-a5e9-90dff4a6966d	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3ODAwNTk4MjYsImV4cCI6MTc4MjY1MTgyNn0.9guVMbHVpBOirY_4NtyeWwTaH_Z0xOdkJ1vsyTod-Bs	\N	\N	2026-06-28 18:33:46.135	f	2026-05-29 18:33:46.136028
cc79f9b4-5add-4629-a4f1-451ff1093ef7	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3ODAwNTk4MjYsImV4cCI6MTc4MjY1MTgyNn0.9guVMbHVpBOirY_4NtyeWwTaH_Z0xOdkJ1vsyTod-Bs	\N	\N	2026-06-28 18:33:46.136	f	2026-05-29 18:33:46.137199
1a9c2e8b-d70a-490e-854f-062444b0c46e	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3ODAwNTk4MjYsImV4cCI6MTc4MjY1MTgyNn0.9guVMbHVpBOirY_4NtyeWwTaH_Z0xOdkJ1vsyTod-Bs	\N	\N	2026-06-28 18:33:46.138	f	2026-05-29 18:33:46.142126
3b2533af-1e1e-4e61-9fa1-faa89d2032fd	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3ODAwNTk4MjgsImV4cCI6MTc4MjY1MTgyOH0.X_h0ZZg3iunmGd7XvsoL7SkFQhNQti_T9gDC4cjkC6k	\N	\N	2026-06-28 18:33:48.063	f	2026-05-29 18:33:48.063531
f8e15bbc-c650-4c72-9a88-8238d26a6d42	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3ODAwNTk4NDEsImV4cCI6MTc4MjY1MTg0MX0.SzuEFkfl33hnywSDStBq_A18kttotIAp-lpl9NcXQck	\N	\N	2026-06-28 18:34:01.228	f	2026-05-29 18:34:01.228251
af05fbc2-a9ce-451b-90f5-a3319c2cbfa4	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3ODAwNTk5MzcsImV4cCI6MTc4MjY1MTkzN30.Ra8ceUtn_-ktQEmkNa9KtQw51my78cY3WxKli-MYzV4	\N	\N	2026-06-28 18:35:37.92	f	2026-05-29 18:35:37.920911
b00f5ed8-7b4d-43b3-b73c-929d8c5fe176	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3ODAwNTk5NTQsImV4cCI6MTc4MjY1MTk1NH0.CI3WhNo-xNh89gPwTQTfeeE65QWbqXVbIWRI_arDAss	\N	\N	2026-06-28 18:35:54.565	f	2026-05-29 18:35:54.565699
acc09ef0-581a-43d0-9a8c-6256044e9b47	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3ODAwNjAwMjksImV4cCI6MTc4MjY1MjAyOX0.SxASV3cIEZcMUeV-XQZC0IpwepK-w8vw3s6FjziRRgs	\N	\N	2026-06-28 18:37:09.218	f	2026-05-29 18:37:09.219061
b762fc3e-192b-4a2a-818a-09fea66c896e	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3ODAwNjAwNTIsImV4cCI6MTc4MjY1MjA1Mn0.E3tr9t5AMC1DzBreVNqc9wcNVieVrorujWph0CBnrn4	\N	\N	2026-06-28 18:37:32.38	f	2026-05-29 18:37:32.380703
825d5b13-3078-47d7-9df7-72a784561996	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3ODAwNjAxMTEsImV4cCI6MTc4MjY1MjExMX0.yBsxnzZuCta-j7J6BAXE9AgnJgpOV4LBuopP2mH_QSQ	\N	\N	2026-06-28 18:38:31.926	f	2026-05-29 18:38:31.926833
6ac9af36-ea54-4ffb-8974-7b87c8665234	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3ODAwNjAzNDUsImV4cCI6MTc4MjY1MjM0NX0.4tNApNBFwuvwLPt9n5wEKDQvw52fER7zaszIPy76qHY	\N	\N	2026-06-28 18:42:25.743	f	2026-05-29 18:42:25.743321
dec3494c-9418-496e-9e1d-13b70d86ca2b	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3ODAwNjA0NDUsImV4cCI6MTc4MjY1MjQ0NX0.5fU_6zJGccrU7NeajgLHqhv1CyHhFmrgIjhw9NRFIIw	\N	\N	2026-06-28 18:44:05.068	f	2026-05-29 18:44:05.068757
70849f3c-2835-475b-ae2b-784238c8d33f	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3ODAwNjA0NzQsImV4cCI6MTc4MjY1MjQ3NH0.XMn10OcrD-5fQ8Rjm0HOXQCqiug8I1X2k6t4RWML5z8	\N	\N	2026-06-28 18:44:34.335	f	2026-05-29 18:44:34.336093
674de1f4-0a48-467c-98b3-c3121be6ae2f	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3ODAwNjA3NTIsImV4cCI6MTc4MjY1Mjc1Mn0.c7C4CPBQw9akbCz9XS09wZWR0kp-XR5cafVfFDYxxgQ	\N	\N	2026-06-28 18:49:12.732	f	2026-05-29 18:49:12.732455
d3daafc1-8a6d-44e0-a36b-72c413be7495	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3ODAwNjA3NjUsImV4cCI6MTc4MjY1Mjc2NX0.2_Alr9OY3dXGmDa6ebH4qu-noZUBjamD9UPTrXkrdV0	\N	\N	2026-06-28 18:49:25.998	f	2026-05-29 18:49:25.998671
a27bcf80-7fc3-4534-9cc0-c8276681b8db	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3ODAwNjA3NzgsImV4cCI6MTc4MjY1Mjc3OH0.Kr7VZVoltzWSwkN5JIuS-6zKpjiOaXgXvIg6JlaAZcQ	\N	\N	2026-06-28 18:49:38.023	f	2026-05-29 18:49:38.023646
c5be30ad-4835-42df-9e02-8761b8855816	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3ODAwNjA3ODgsImV4cCI6MTc4MjY1Mjc4OH0.nkUhfrOg4iuKyQBrAtJlW5Hf8H4Tn_Oen5wwiAGPUi0	\N	\N	2026-06-28 18:49:48.757	f	2026-05-29 18:49:48.75736
3c6d956f-c857-4810-9a5d-7f98f668bfc8	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3ODAwNjE3ODYsImV4cCI6MTc4MjY1Mzc4Nn0.iDJxidF3ulE96Nl1wytruKhpSRnt_PjAZvFOV8zl-4g	\N	\N	2026-06-28 19:06:26.063	f	2026-05-29 19:06:26.063352
1d25b9ac-c0b3-47b8-b09b-09ea7d66f018	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3ODAwNjE3OTUsImV4cCI6MTc4MjY1Mzc5NX0.GWkEF87-5LO3vv1cS899ahBsQonu-CVyaPLY7TgUZQs	\N	\N	2026-06-28 19:06:35.123	f	2026-05-29 19:06:35.124139
fcfad043-bc5f-4c4f-8b1a-87107a834a52	313b3836-dd4c-4bab-8ca1-387b05062ea7	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIzMTNiMzgzNi1kZDRjLTRiYWItOGNhMS0zODdiMDUwNjJlYTciLCJpYXQiOjE3ODAwNjMzMzgsImV4cCI6MTc4MjY1NTMzOH0.706ZlUsBpXcDLjTUghTgmlHJ7SfiRT2iVMndz3jSRpU	\N	\N	2026-06-28 19:32:18.487	f	2026-05-29 19:32:18.487568
7ec036a6-0525-4f2d-aab0-419854bfd052	313b3836-dd4c-4bab-8ca1-387b05062ea7	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIzMTNiMzgzNi1kZDRjLTRiYWItOGNhMS0zODdiMDUwNjJlYTciLCJpYXQiOjE3ODAwNjMzMzgsImV4cCI6MTc4MjY1NTMzOH0.706ZlUsBpXcDLjTUghTgmlHJ7SfiRT2iVMndz3jSRpU	\N	\N	2026-06-28 19:32:18.487	f	2026-05-29 19:32:18.488
ca90ea69-d0c0-4355-8d24-5d315a69457d	313b3836-dd4c-4bab-8ca1-387b05062ea7	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIzMTNiMzgzNi1kZDRjLTRiYWItOGNhMS0zODdiMDUwNjJlYTciLCJpYXQiOjE3ODAwNjMzMzgsImV4cCI6MTc4MjY1NTMzOH0.706ZlUsBpXcDLjTUghTgmlHJ7SfiRT2iVMndz3jSRpU	\N	\N	2026-06-28 19:32:18.488	f	2026-05-29 19:32:18.488433
97d6a503-a99a-4eb9-832f-1e7ba96f26bf	313b3836-dd4c-4bab-8ca1-387b05062ea7	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIzMTNiMzgzNi1kZDRjLTRiYWItOGNhMS0zODdiMDUwNjJlYTciLCJpYXQiOjE3ODAwNjAxNzYsImV4cCI6MTc4MjY1MjE3Nn0.t72bepRplFiwlxJFDTEhljepPNNjVUBN9ClR6BhmTSo	\N	\N	2026-06-28 18:39:36.274	t	2026-05-29 18:39:36.275028
2e317292-737d-44e6-a949-d1af04b737b6	313b3836-dd4c-4bab-8ca1-387b05062ea7	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIzMTNiMzgzNi1kZDRjLTRiYWItOGNhMS0zODdiMDUwNjJlYTciLCJpYXQiOjE3ODAwNjE4NDEsImV4cCI6MTc4MjY1Mzg0MX0.bEvDSgwe6yywBoxZWzjV1PFeFRskgTdB32oQqxD2i7g	\N	\N	2026-06-28 19:07:21.559	f	2026-05-29 19:07:21.55961
d5b03b56-c751-4263-b613-02806978cfa4	313b3836-dd4c-4bab-8ca1-387b05062ea7	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIzMTNiMzgzNi1kZDRjLTRiYWItOGNhMS0zODdiMDUwNjJlYTciLCJpYXQiOjE3ODAwNjE4NDEsImV4cCI6MTc4MjY1Mzg0MX0.bEvDSgwe6yywBoxZWzjV1PFeFRskgTdB32oQqxD2i7g	\N	\N	2026-06-28 19:07:21.56	f	2026-05-29 19:07:21.560147
f7ddbf72-46f0-473f-aaa8-8185c3108d7b	313b3836-dd4c-4bab-8ca1-387b05062ea7	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIzMTNiMzgzNi1kZDRjLTRiYWItOGNhMS0zODdiMDUwNjJlYTciLCJpYXQiOjE3ODAwNjE4NDEsImV4cCI6MTc4MjY1Mzg0MX0.bEvDSgwe6yywBoxZWzjV1PFeFRskgTdB32oQqxD2i7g	\N	\N	2026-06-28 19:07:21.56	f	2026-05-29 19:07:21.560565
e5423db9-596f-4003-8705-ec1bbbef5ac7	313b3836-dd4c-4bab-8ca1-387b05062ea7	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIzMTNiMzgzNi1kZDRjLTRiYWItOGNhMS0zODdiMDUwNjJlYTciLCJpYXQiOjE3ODAwNjE4NDEsImV4cCI6MTc4MjY1Mzg0MX0.bEvDSgwe6yywBoxZWzjV1PFeFRskgTdB32oQqxD2i7g	\N	\N	2026-06-28 19:07:21.56	f	2026-05-29 19:07:21.561084
f02f1977-5e76-4178-a066-f84c95eedddd	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3ODAwNjE4NDMsImV4cCI6MTc4MjY1Mzg0M30.lRim_N0CE6IIPlTJqoc2aggYpeaJH-ZxXzB_QRe0HVc	\N	\N	2026-06-28 19:07:23.961	f	2026-05-29 19:07:23.961895
6990a79c-0c8f-4ec5-baf2-746cc25144f1	313b3836-dd4c-4bab-8ca1-387b05062ea7	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIzMTNiMzgzNi1kZDRjLTRiYWItOGNhMS0zODdiMDUwNjJlYTciLCJpYXQiOjE3ODAwNjMzMzgsImV4cCI6MTc4MjY1NTMzOH0.706ZlUsBpXcDLjTUghTgmlHJ7SfiRT2iVMndz3jSRpU	\N	\N	2026-06-28 19:32:18.488	f	2026-05-29 19:32:18.488879
1e74dd98-5077-49db-a29e-f68b3af17ff7	313b3836-dd4c-4bab-8ca1-387b05062ea7	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIzMTNiMzgzNi1kZDRjLTRiYWItOGNhMS0zODdiMDUwNjJlYTciLCJpYXQiOjE3ODAwNjMzMzgsImV4cCI6MTc4MjY1NTMzOH0.706ZlUsBpXcDLjTUghTgmlHJ7SfiRT2iVMndz3jSRpU	\N	\N	2026-06-28 19:32:18.489	f	2026-05-29 19:32:18.48937
079fcff6-1ac8-4bf5-b3a2-3abdd94a92e9	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3ODAwNjMzNDAsImV4cCI6MTc4MjY1NTM0MH0.jqYfqPdwmw5iWk_ROmIfdL-jpVu0FJPWyO5EBW63N1w	\N	\N	2026-06-28 19:32:20.06	f	2026-05-29 19:32:20.061049
0a9e0da9-7502-4f65-a8f7-7427d4593bff	313b3836-dd4c-4bab-8ca1-387b05062ea7	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIzMTNiMzgzNi1kZDRjLTRiYWItOGNhMS0zODdiMDUwNjJlYTciLCJpYXQiOjE3ODAwNjMzNTMsImV4cCI6MTc4MjY1NTM1M30.rV2vuvFkYsy3uEauDtTynVvQ2RsaA1wSn-KptSnIyBI	\N	\N	2026-06-28 19:32:33.336	f	2026-05-29 19:32:33.337061
4a2cff3e-7393-4a21-bf51-183a25a2d1ff	313b3836-dd4c-4bab-8ca1-387b05062ea7	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIzMTNiMzgzNi1kZDRjLTRiYWItOGNhMS0zODdiMDUwNjJlYTciLCJpYXQiOjE3ODAwNjE4NjIsImV4cCI6MTc4MjY1Mzg2Mn0.AuKLGYs5WcddHAL3Vtne50cpxhgXcRm7njrJqh-4TTw	\N	\N	2026-06-28 19:07:42.285	t	2026-05-29 19:07:42.285737
3d686267-f9ef-4a3f-802d-10454e80c5f1	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3ODAwNjQxMDIsImV4cCI6MTc4MjY1NjEwMn0.PWltGVcWEYsveLKFL7VBYtzzPK1qyI3nlN4o-qZc6K8	\N	\N	2026-06-28 19:45:02.512	t	2026-05-29 19:45:02.512903
45b66f80-4eb8-410d-ac0b-35525cadfcda	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3ODAwNjUxMDYsImV4cCI6MTc4MjY1NzEwNn0.6OwD4UMh-z247pLdC77JROMlq6Ccwd3VMdzcw7UN8c4	\N	\N	2026-06-28 20:01:46.847	f	2026-05-29 20:01:46.847422
e1d59061-2888-43f9-bb7a-57c4c7c1147d	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3ODAwNjUxMDYsImV4cCI6MTc4MjY1NzEwNn0.6OwD4UMh-z247pLdC77JROMlq6Ccwd3VMdzcw7UN8c4	\N	\N	2026-06-28 20:01:46.847	f	2026-05-29 20:01:46.84786
2cec7893-55e9-43ca-ae1a-0cc24ac87e88	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3ODAwNjUxMDYsImV4cCI6MTc4MjY1NzEwNn0.6OwD4UMh-z247pLdC77JROMlq6Ccwd3VMdzcw7UN8c4	\N	\N	2026-06-28 20:01:46.848	f	2026-05-29 20:01:46.848286
16a02e27-7303-4da0-90cc-94f752e7cbe1	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3ODAwNjUxMDYsImV4cCI6MTc4MjY1NzEwNn0.6OwD4UMh-z247pLdC77JROMlq6Ccwd3VMdzcw7UN8c4	\N	\N	2026-06-28 20:01:46.851	f	2026-05-29 20:01:46.851245
539a6684-3ef7-4ba0-8088-0e7032cda358	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3ODAwNjUxMDksImV4cCI6MTc4MjY1NzEwOX0.GGVS0AyFFo8J_innnvfAt-XaIyiZ97bbpaVQPe5fjwg	\N	\N	2026-06-28 20:01:49.336	f	2026-05-29 20:01:49.336858
6b518ed5-1228-4722-8048-a3184042dacb	313b3836-dd4c-4bab-8ca1-387b05062ea7	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIzMTNiMzgzNi1kZDRjLTRiYWItOGNhMS0zODdiMDUwNjJlYTciLCJpYXQiOjE3ODAwNjUyMTgsImV4cCI6MTc4MjY1NzIxOH0.sgwjLZ2ji76qdCcFTMwaLAEmGMzd0yvAw7pqI7X8aAE	\N	\N	2026-06-28 20:03:38.998	t	2026-05-29 20:03:38.998976
bdcd563c-e43f-427c-8036-7021258314fe	313b3836-dd4c-4bab-8ca1-387b05062ea7	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIzMTNiMzgzNi1kZDRjLTRiYWItOGNhMS0zODdiMDUwNjJlYTciLCJpYXQiOjE3ODAwNjYxMjAsImV4cCI6MTc4MjY1ODEyMH0.wdIOnDPQbKtWsaU1N0uOFR2XNqtTE4ITnQFUrJj7NZI	\N	\N	2026-06-28 20:18:40.895	f	2026-05-29 20:18:40.895959
9bb2121e-6d68-4aa2-b4ad-c4540edcfdaf	313b3836-dd4c-4bab-8ca1-387b05062ea7	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIzMTNiMzgzNi1kZDRjLTRiYWItOGNhMS0zODdiMDUwNjJlYTciLCJpYXQiOjE3ODAwNjYxMjAsImV4cCI6MTc4MjY1ODEyMH0.wdIOnDPQbKtWsaU1N0uOFR2XNqtTE4ITnQFUrJj7NZI	\N	\N	2026-06-28 20:18:40.897	f	2026-05-29 20:18:40.897575
f64a3621-588b-40aa-b9a0-10b7ad6fbc15	313b3836-dd4c-4bab-8ca1-387b05062ea7	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIzMTNiMzgzNi1kZDRjLTRiYWItOGNhMS0zODdiMDUwNjJlYTciLCJpYXQiOjE3ODAwNjYxMjgsImV4cCI6MTc4MjY1ODEyOH0.ELK2euxUQuhXBwDspD654T_iWU0_4WBKKLMJjy_ckHw	\N	\N	2026-06-28 20:18:48.529	t	2026-05-29 20:18:48.529647
600a2eaf-5fed-426e-8186-c24c3bc7101f	313b3836-dd4c-4bab-8ca1-387b05062ea7	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIzMTNiMzgzNi1kZDRjLTRiYWItOGNhMS0zODdiMDUwNjJlYTciLCJpYXQiOjE3ODAwNjcyNjUsImV4cCI6MTc4MjY1OTI2NX0.jmsjIy-kIkm1tKXY6hQcExl6TWuj_ju_wfpK2lo2964	\N	\N	2026-06-28 20:37:45.57	f	2026-05-29 20:37:45.570267
0930931a-1263-413d-88ff-1a136153cc1a	313b3836-dd4c-4bab-8ca1-387b05062ea7	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIzMTNiMzgzNi1kZDRjLTRiYWItOGNhMS0zODdiMDUwNjJlYTciLCJpYXQiOjE3ODAwNjcyNjUsImV4cCI6MTc4MjY1OTI2NX0.jmsjIy-kIkm1tKXY6hQcExl6TWuj_ju_wfpK2lo2964	\N	\N	2026-06-28 20:37:45.57	f	2026-05-29 20:37:45.57077
72e4b618-2d57-4da0-a11f-60d12c092da6	313b3836-dd4c-4bab-8ca1-387b05062ea7	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIzMTNiMzgzNi1kZDRjLTRiYWItOGNhMS0zODdiMDUwNjJlYTciLCJpYXQiOjE3ODAwNjcyNzgsImV4cCI6MTc4MjY1OTI3OH0.M42jB8SjQXxO6Ml1tSk9_xPax1MBDrHapppB1YcvnEY	\N	\N	2026-06-28 20:37:58.881	t	2026-05-29 20:37:58.881905
1df11cdd-853d-4f8d-9890-12e101da97c9	313b3836-dd4c-4bab-8ca1-387b05062ea7	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIzMTNiMzgzNi1kZDRjLTRiYWItOGNhMS0zODdiMDUwNjJlYTciLCJpYXQiOjE3ODAwNjg0MzcsImV4cCI6MTc4MjY2MDQzN30.3u4X6fqYSoqX3cxwtdLYNEOcHAgQW205XLK-X2_n3W8	\N	\N	2026-06-28 20:57:17.691	f	2026-05-29 20:57:17.691657
801880ff-4ef8-4c80-9049-d370b63e2b9c	313b3836-dd4c-4bab-8ca1-387b05062ea7	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIzMTNiMzgzNi1kZDRjLTRiYWItOGNhMS0zODdiMDUwNjJlYTciLCJpYXQiOjE3ODAwNjg0MzcsImV4cCI6MTc4MjY2MDQzN30.3u4X6fqYSoqX3cxwtdLYNEOcHAgQW205XLK-X2_n3W8	\N	\N	2026-06-28 20:57:17.693	f	2026-05-29 20:57:17.693168
aa61b76a-f8d6-4680-b8f6-4daa6b0e9ada	313b3836-dd4c-4bab-8ca1-387b05062ea7	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIzMTNiMzgzNi1kZDRjLTRiYWItOGNhMS0zODdiMDUwNjJlYTciLCJpYXQiOjE3ODAwNjg0MzcsImV4cCI6MTc4MjY2MDQzN30.3u4X6fqYSoqX3cxwtdLYNEOcHAgQW205XLK-X2_n3W8	\N	\N	2026-06-28 20:57:17.693	f	2026-05-29 20:57:17.693607
d2f8d483-c752-4b2e-a17e-91d1262ff351	313b3836-dd4c-4bab-8ca1-387b05062ea7	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIzMTNiMzgzNi1kZDRjLTRiYWItOGNhMS0zODdiMDUwNjJlYTciLCJpYXQiOjE3ODAwNjg0MzcsImV4cCI6MTc4MjY2MDQzN30.3u4X6fqYSoqX3cxwtdLYNEOcHAgQW205XLK-X2_n3W8	\N	\N	2026-06-28 20:57:17.694	f	2026-05-29 20:57:17.694103
b7cb50ff-8820-4350-8886-dad6014e7f32	313b3836-dd4c-4bab-8ca1-387b05062ea7	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIzMTNiMzgzNi1kZDRjLTRiYWItOGNhMS0zODdiMDUwNjJlYTciLCJpYXQiOjE3ODAwNjg0NDgsImV4cCI6MTc4MjY2MDQ0OH0.ol0i5l-rUpAfZFFm262eDLpMFb7TKW0ZQY2yzWjJZ2o	\N	\N	2026-06-28 20:57:28.048	f	2026-05-29 20:57:28.0484
59f085ae-1d0a-4826-989c-7ea0440d5586	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3ODAwNjg0ODksImV4cCI6MTc4MjY2MDQ4OX0.aRXtcR_o265LjzGpwJVa_6vXHIP3fq-L79SCqHd7JM4	\N	\N	2026-06-28 20:58:09.024	f	2026-05-29 20:58:09.024156
1483b7d7-c56d-4b90-8e3d-e5ba9c341394	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjdjMzZlZS1hZWM4LTQzMGQtYjVlOC1lYTNiMzdmNGM2MWMiLCJpYXQiOjE3ODAwNjg1NTMsImV4cCI6MTc4MjY2MDU1M30.J16ARY6xr6bpKT6cVthrKG9N8sQrEdFso8gz3kmxC3M	\N	\N	2026-06-28 20:59:13.964	f	2026-05-29 20:59:13.964384
619a95ef-d7aa-4207-9b4c-05eedfd5ac7d	fe400696-c6f1-4122-b97e-c7f825f39d25	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZTQwMDY5Ni1jNmYxLTQxMjItYjk3ZS1jN2Y4MjVmMzlkMjUiLCJpYXQiOjE3ODAwNjg1NzUsImV4cCI6MTc4MjY2MDU3NX0.oSDgG2iGbrye2nAcHyRtU34ZK3e58t0Q6OqSiHR950Y	\N	\N	2026-06-28 20:59:35.467	f	2026-05-29 20:59:35.467951
df41d310-ad1e-42b9-9291-c22b11ca8dc5	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3ODAwNjg3NDcsImV4cCI6MTc4MjY2MDc0N30.A5IgX_33I3-SvBZ6_sS0BMLvuQTNJjYSllGmX41KIz8	\N	\N	2026-06-28 21:02:27.855	f	2026-05-29 21:02:27.855371
d2d93123-fd4f-40f7-a869-96187c9d86ac	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYmIzZDM0Yy00ZWFlLTQ2YmQtOGYyNC1jZjFjOTA5NmFjNzAiLCJpYXQiOjE3ODAwNjkxMzksImV4cCI6MTc4MjY2MTEzOX0.Pf4jhxy-tc6LWHlVhLV5nteLY7kWTJ3-76-ap6scUwQ	\N	\N	2026-06-28 21:08:59.448	f	2026-05-29 21:08:59.448487
41f19d0a-84e3-4229-9f9a-7cafa0b3c8ee	313b3836-dd4c-4bab-8ca1-387b05062ea7	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIzMTNiMzgzNi1kZDRjLTRiYWItOGNhMS0zODdiMDUwNjJlYTciLCJpYXQiOjE3ODAwNjg3OTAsImV4cCI6MTc4MjY2MDc5MH0.3ErRwoCqEzdKNVl7sMtZnBFhX-zky8wclqAleXf99UU	\N	\N	2026-06-28 21:03:10.733	t	2026-05-29 21:03:10.733765
4afcd810-a5b8-436d-baec-555bdf53d350	313b3836-dd4c-4bab-8ca1-387b05062ea7	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIzMTNiMzgzNi1kZDRjLTRiYWItOGNhMS0zODdiMDUwNjJlYTciLCJpYXQiOjE3ODAwNzA3MTUsImV4cCI6MTc4MjY2MjcxNX0.SdXkV-QiGmLn1G9mEwINZHJdWYY7yxPYA05SKVtticY	\N	\N	2026-06-28 21:35:15.262	f	2026-05-29 21:35:15.262966
4ac9bd4f-287d-436a-a428-72dc86b2758d	313b3836-dd4c-4bab-8ca1-387b05062ea7	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIzMTNiMzgzNi1kZDRjLTRiYWItOGNhMS0zODdiMDUwNjJlYTciLCJpYXQiOjE3ODAwNzA3MTUsImV4cCI6MTc4MjY2MjcxNX0.SdXkV-QiGmLn1G9mEwINZHJdWYY7yxPYA05SKVtticY	\N	\N	2026-06-28 21:35:15.263	f	2026-05-29 21:35:15.263444
3ccddd21-6b82-4ecc-b127-59eb7517a6aa	313b3836-dd4c-4bab-8ca1-387b05062ea7	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIzMTNiMzgzNi1kZDRjLTRiYWItOGNhMS0zODdiMDUwNjJlYTciLCJpYXQiOjE3ODAwNzA3MTUsImV4cCI6MTc4MjY2MjcxNX0.SdXkV-QiGmLn1G9mEwINZHJdWYY7yxPYA05SKVtticY	\N	\N	2026-06-28 21:35:15.263	f	2026-05-29 21:35:15.263828
00a2f73d-9416-47ae-bae0-c547c94a8b88	313b3836-dd4c-4bab-8ca1-387b05062ea7	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIzMTNiMzgzNi1kZDRjLTRiYWItOGNhMS0zODdiMDUwNjJlYTciLCJpYXQiOjE3ODAwNzA3MTUsImV4cCI6MTc4MjY2MjcxNX0.SdXkV-QiGmLn1G9mEwINZHJdWYY7yxPYA05SKVtticY	\N	\N	2026-06-28 21:35:15.264	f	2026-05-29 21:35:15.264226
2ef7ec2d-ec4d-4084-b99e-3c3956ee27c9	313b3836-dd4c-4bab-8ca1-387b05062ea7	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIzMTNiMzgzNi1kZDRjLTRiYWItOGNhMS0zODdiMDUwNjJlYTciLCJpYXQiOjE3ODAwNzA3MTUsImV4cCI6MTc4MjY2MjcxNX0.SdXkV-QiGmLn1G9mEwINZHJdWYY7yxPYA05SKVtticY	\N	\N	2026-06-28 21:35:15.264	f	2026-05-29 21:35:15.264635
bdb2caaa-7b71-4c3b-b03d-cac51ef6df1c	313b3836-dd4c-4bab-8ca1-387b05062ea7	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIzMTNiMzgzNi1kZDRjLTRiYWItOGNhMS0zODdiMDUwNjJlYTciLCJpYXQiOjE3ODAwNzA3MTUsImV4cCI6MTc4MjY2MjcxNX0.SdXkV-QiGmLn1G9mEwINZHJdWYY7yxPYA05SKVtticY	\N	\N	2026-06-28 21:35:15.264	f	2026-05-29 21:35:15.265007
31f7dfa1-535a-4594-9307-83a80573bd15	313b3836-dd4c-4bab-8ca1-387b05062ea7	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIzMTNiMzgzNi1kZDRjLTRiYWItOGNhMS0zODdiMDUwNjJlYTciLCJpYXQiOjE3ODAwNzA3MjUsImV4cCI6MTc4MjY2MjcyNX0.ldjG7oL55ZtLag8RwbuQaaa6YEvc1jWQyu2nqaDZpII	\N	\N	2026-06-28 21:35:25.841	f	2026-05-29 21:35:25.841477
\.


--
-- Data for Name: roles; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.roles (id, role_name, created_at) FROM stdin;
d8324d5d-995c-4792-947a-22746abd67b1	student	2026-05-21 17:32:02.180395
4e1a3ef0-c20a-44e4-a2a5-6bf8587f17bc	teacher	2026-05-21 17:32:02.180935
65aeca86-bd3e-4702-9624-533eef5f3af1	parent	2026-05-21 17:32:02.181203
65959336-daaf-4462-ba72-b23fd237d2ad	admin	2026-05-21 17:32:02.181462
c9905fc3-fa52-4fe0-8d17-638518b49705	superadmin	2026-05-21 17:32:02.181655
\.


--
-- Data for Name: stories; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.stories (id, organization_id, title, description, cover_image_url, class_level, scheduled_at, ended_at, status, created_by, created_at, updated_at, published_at) FROM stdin;
14defc83-9b7f-47e9-8e1d-3b1a010b9828	8ba8388f-9907-486c-9883-3784c2f2f34e	Next story	Next story	\N	1	\N	2026-05-28 15:29:20.984+05:30	ended	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	2026-05-28 15:14:49.956584+05:30	2026-05-28 15:29:20.985435+05:30	2026-05-28 15:29:05.996273+05:30
65ccde55-0714-49a0-9df4-88ca6734223d	8ba8388f-9907-486c-9883-3784c2f2f34e	New Story	My New Story	\N	1	2026-05-30 09:00:00+05:30	\N	scheduled	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	2026-05-28 14:36:47.675466+05:30	2026-05-28 15:29:53.322664+05:30	\N
dcd404b8-c849-44c8-8abd-db6e9134adef	8ba8388f-9907-486c-9883-3784c2f2f34e	Story newx	Story newx	\N	1	\N	2026-05-29 00:00:56.757297+05:30	ended	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	2026-05-28 15:56:34.325707+05:30	2026-05-29 00:00:56.757297+05:30	2026-05-28 15:57:17.859875+05:30
ffab6f2a-98af-4dc5-bf19-e8cfcb6d3301	8ba8388f-9907-486c-9883-3784c2f2f34e	The Wise Old Owl	An owl who listens more and speaks less.	/media/pictures/owl.png	LKG	\N	\N	live	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	2026-05-29 21:09:00.138536+05:30	2026-05-29 21:09:00.159374+05:30	2026-05-29 21:09:00.159374+05:30
fceba848-5c3d-40f8-9161-a67567819632	8ba8388f-9907-486c-9883-3784c2f2f34e	The Thirsty Crow	A clever crow finds a smart way to drink water.	/media/pictures/crow.png	LKG	\N	2026-05-29 21:09:00.256+05:30	ended	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	2026-05-29 21:09:00.242606+05:30	2026-05-29 21:09:00.257134+05:30	\N
584ef2f3-07dc-4761-b3ea-67a940ef7281	8ba8388f-9907-486c-9883-3784c2f2f34e	The Lion and the Mouse	A tiny mouse helps a mighty lion.	/media/pictures/lion.png	LKG	\N	2026-05-29 21:09:00.76+05:30	ended	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	2026-05-29 21:09:00.747137+05:30	2026-05-29 21:09:00.761139+05:30	\N
f6ffb8b4-3a3e-4d08-847d-35eec40c4c75	8ba8388f-9907-486c-9883-3784c2f2f34e	The Happy Duck	A cheerful duck and its favourite pond.	/media/pictures/duck.png	LKG	2026-05-31 09:00:00+05:30	\N	scheduled	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	2026-05-29 21:09:01.2529+05:30	2026-05-29 21:09:01.275364+05:30	\N
fdcb62ae-f1c9-4478-aab5-aab77c537994	8ba8388f-9907-486c-9883-3784c2f2f34e	The Gentle Elephant	A big, gentle elephant who loves bath time.	/media/pictures/elephant.png	LKG	2026-06-02 09:00:00+05:30	\N	scheduled	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	2026-05-29 21:09:01.827708+05:30	2026-05-29 21:09:01.839686+05:30	\N
\.


--
-- Data for Name: story_progress; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.story_progress (id, user_id, story_id, current_section_id, completed_section_ids, started_at, completed_at, last_active_at) FROM stdin;
3f0bf583-bc8d-45b9-ad65-c2e39d7c4e47	fe400696-c6f1-4122-b97e-c7f825f39d25	65ccde55-0714-49a0-9df4-88ca6734223d	bd78d1f0-fa67-425b-bef4-33471b6dabbb	{19c5c9d1-88f5-402d-b3b9-6314b5baba0e,bd78d1f0-fa67-425b-bef4-33471b6dabbb}	2026-05-28 14:45:53.341801+05:30	\N	2026-05-28 15:11:38.141418+05:30
9b97596b-fb0f-4e74-b7fb-7d81439d5d5a	fe400696-c6f1-4122-b97e-c7f825f39d25	14defc83-9b7f-47e9-8e1d-3b1a010b9828	f09a2327-5e7f-47ce-aaf7-b5382c89b4ae	{f09a2327-5e7f-47ce-aaf7-b5382c89b4ae}	2026-05-28 15:29:13.179803+05:30	2026-05-28 15:29:13.179+05:30	2026-05-28 15:29:13.179803+05:30
ef852d8d-abe6-4d70-8a0f-3cf57182bb59	fe400696-c6f1-4122-b97e-c7f825f39d25	dcd404b8-c849-44c8-8abd-db6e9134adef	0a663c62-7457-4063-b486-4e7aed0c05b7	{0a663c62-7457-4063-b486-4e7aed0c05b7}	2026-05-28 15:57:57.51828+05:30	2026-05-28 15:57:57.517+05:30	2026-05-28 15:57:57.51828+05:30
db2dba2e-ffb2-4a53-ba64-4e295c63871f	3d074d19-5d5d-46fa-b43c-9f1c9f257983	dcd404b8-c849-44c8-8abd-db6e9134adef	0a663c62-7457-4063-b486-4e7aed0c05b7	{0a663c62-7457-4063-b486-4e7aed0c05b7}	2026-05-29 12:42:06.339849+05:30	2026-05-29 12:42:06.339+05:30	2026-05-29 12:42:06.339849+05:30
d4202fac-60bc-4944-866e-f01db6746f1f	313b3836-dd4c-4bab-8ca1-387b05062ea7	ffab6f2a-98af-4dc5-bf19-e8cfcb6d3301	ac7be802-370c-44a7-a31a-c1121244952a	{ac7be802-370c-44a7-a31a-c1121244952a}	2026-05-29 21:40:50.483468+05:30	\N	2026-05-29 21:40:50.483468+05:30
99f58c5e-a4a1-4f18-a527-04604c2cf8ab	313b3836-dd4c-4bab-8ca1-387b05062ea7	584ef2f3-07dc-4761-b3ea-67a940ef7281	5e363f42-0127-4bea-a0da-9bbc392c14d3	{7e3f7872-b04d-4ac7-b6fb-de6daa5e8efb,5e363f42-0127-4bea-a0da-9bbc392c14d3}	2026-05-29 21:41:09.818215+05:30	2026-05-29 21:41:30.071+05:30	2026-05-29 21:41:30.071349+05:30
\.


--
-- Data for Name: story_sections; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.story_sections (id, story_id, title, body_text, media, quiz_id, order_index, created_at, updated_at) FROM stdin;
bd78d1f0-fa67-425b-bef4-33471b6dabbb	65ccde55-0714-49a0-9df4-88ca6734223d	My SECRION	My SECRION	[{"url": "https://www.youtube.com/watch?v=RIQDmnIJZv8&t=8s", "kind": "video", "caption": "ABC"}]	922c6dcc-7ded-4249-9e8f-52b7f56d515e	0	2026-05-28 15:10:09.989918+05:30	2026-05-28 15:10:09.989918+05:30
669fdc32-1235-4d5a-a476-5e5e023b6387	65ccde55-0714-49a0-9df4-88ca6734223d	sections 2	\N	[{"url": "https://www.youtube.com/watch?v=RIQDmnIJZv8&t=8s", "kind": "video"}]	42848837-bd7f-4e3b-b558-2b2805b16192	1	2026-05-28 15:11:08.343743+05:30	2026-05-28 15:11:08.343743+05:30
f09a2327-5e7f-47ce-aaf7-b5382c89b4ae	14defc83-9b7f-47e9-8e1d-3b1a010b9828	Next story	Next story	[]	\N	0	2026-05-28 15:14:53.170989+05:30	2026-05-28 15:14:53.170989+05:30
0a663c62-7457-4063-b486-4e7aed0c05b7	dcd404b8-c849-44c8-8abd-db6e9134adef	Story newx	Story newx	[]	42848837-bd7f-4e3b-b558-2b2805b16192	0	2026-05-28 15:56:40.765433+05:30	2026-05-28 16:12:31.896503+05:30
ac7be802-370c-44a7-a31a-c1121244952a	ffab6f2a-98af-4dc5-bf19-e8cfcb6d3301	Once upon a time	High up in a big tree lived a wise old owl. All night the owl watched the quiet forest with its big round eyes.	[{"url": "/media/pictures/owl.png", "kind": "image", "caption": "The Wise Old Owl"}]	\N	0	2026-05-29 21:09:00.14639+05:30	2026-05-29 21:09:00.14639+05:30
4a5e9aa9-8965-40f2-99ac-f6a0200b4a66	ffab6f2a-98af-4dc5-bf19-e8cfcb6d3301	What happened next	The owl listened a lot and spoke a little. Because it listened so well, it learned many things. Good listeners learn the most!	[]	ab8b2ade-1784-4e1a-95d9-aaebc477e42e	1	2026-05-29 21:09:00.152037+05:30	2026-05-29 21:09:00.152037+05:30
d2b534df-d0de-450b-8d0d-a515f38b8d6e	fceba848-5c3d-40f8-9161-a67567819632	Once upon a time	On a hot day, a thirsty crow looked everywhere for water. At last it found a pot with only a little water at the bottom.	[{"url": "/media/pictures/crow.png", "kind": "image", "caption": "The Thirsty Crow"}]	\N	0	2026-05-29 21:09:00.247553+05:30	2026-05-29 21:09:00.247553+05:30
e4659bec-d87f-43fd-b4b7-69601949c479	fceba848-5c3d-40f8-9161-a67567819632	What happened next	The clever crow dropped small stones into the pot, one by one. The water rose up and up — and the happy crow had a lovely drink!	[]	17441c78-2840-40c7-af50-97eaec763fd2	1	2026-05-29 21:09:00.252235+05:30	2026-05-29 21:09:00.252235+05:30
7e3f7872-b04d-4ac7-b6fb-de6daa5e8efb	584ef2f3-07dc-4761-b3ea-67a940ef7281	Once upon a time	A big lion was sleeping when a little mouse ran over him. The lion woke up, but kindly let the tiny mouse go.	[{"url": "/media/pictures/lion.png", "kind": "image", "caption": "The Lion and the Mouse"}]	\N	0	2026-05-29 21:09:00.752626+05:30	2026-05-29 21:09:00.752626+05:30
5e363f42-0127-4bea-a0da-9bbc392c14d3	584ef2f3-07dc-4761-b3ea-67a940ef7281	What happened next	Later, the lion was caught in a hunter’s net. The little mouse chewed the net and set the lion free. Even small friends can help!	[]	8a970f86-cf49-4930-9f82-8130fdf6440f	1	2026-05-29 21:09:00.757212+05:30	2026-05-29 21:09:00.757212+05:30
560b7533-7f4d-4f6e-aefa-e26eca0d843d	f6ffb8b4-3a3e-4d08-847d-35eec40c4c75	Once upon a time	A happy little duck loved its blue pond. Every morning it went, "Quack, quack!" and splashed in the cool water.	[{"url": "/media/pictures/duck.png", "kind": "image", "caption": "The Happy Duck"}]	\N	0	2026-05-29 21:09:01.256795+05:30	2026-05-29 21:09:01.256795+05:30
c44490cd-4bdb-4e1d-a499-f81fe9a8bc99	f6ffb8b4-3a3e-4d08-847d-35eec40c4c75	What happened next	The duck taught its baby ducklings to swim in a line behind it. They paddled all day and had so much fun together.	[]	42b4467a-0d3d-4e75-90ca-3f7c2cc74b00	1	2026-05-29 21:09:01.260537+05:30	2026-05-29 21:09:01.260537+05:30
af51d958-8e28-4ac6-b6ca-146719e56460	fdcb62ae-f1c9-4478-aab5-aab77c537994	Once upon a time	In the green forest lived a big, gentle elephant. It was the largest animal of all, but it had a very kind heart.	[{"url": "/media/pictures/elephant.png", "kind": "image", "caption": "The Gentle Elephant"}]	\N	0	2026-05-29 21:09:01.831698+05:30	2026-05-29 21:09:01.831698+05:30
bb0cf9f1-85b6-4e60-99fb-229eb0b5802b	fdcb62ae-f1c9-4478-aab5-aab77c537994	What happened next	The elephant filled its long trunk with water and gave itself a splashy shower. Then it ate sweet leaves and fruits. What a happy day!	[]	e6eb68ba-7ed2-4cf8-ad0c-ab48b28d7ee7	1	2026-05-29 21:09:01.835691+05:30	2026-05-29 21:09:01.835691+05:30
\.


--
-- Data for Name: student_achievements; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.student_achievements (id, student_id, classroom_id, achievement_id, granted_by, granted_at) FROM stdin;
d3b4388f-c3fa-455d-ac4e-dcaf246acecc	fe400696-c6f1-4122-b97e-c7f825f39d25	1e77a495-0570-417b-a216-7da3ebb7d6d6	0887946a-2fb2-45af-85cb-b1ad27167945	866bc022-307f-4218-94a3-7622dd2aec79	2026-05-22 17:51:29.441657
f494df24-a31b-47ac-aeda-07e034346ce5	fe400696-c6f1-4122-b97e-c7f825f39d25	1e77a495-0570-417b-a216-7da3ebb7d6d6	4f0b5b08-6d3c-43d6-895a-439a00bb6c8f	866bc022-307f-4218-94a3-7622dd2aec79	2026-05-22 17:51:30.291368
1afd2bb2-bcc0-4a2a-af13-4ae167ff8ee8	fe400696-c6f1-4122-b97e-c7f825f39d25	540f0a55-8239-42bc-9465-8329541854c7	b9f345b5-6cb5-41c1-808c-86de5c7dceff	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	2026-05-24 12:25:10.086096
4c1b279d-89f0-4988-8a1b-61298980961b	fe400696-c6f1-4122-b97e-c7f825f39d25	540f0a55-8239-42bc-9465-8329541854c7	28f7cfde-5c3a-4580-badd-a2d323989be2	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	2026-05-24 12:25:14.884191
\.


--
-- Data for Name: student_activity; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.student_activity (id, student_id, organization_id, activity_type, reference_id, reference_title, status, score, time_spent_seconds, activity_date, created_at) FROM stdin;
816f47cc-aabf-4936-8821-fc25a88d0133	fe400696-c6f1-4122-b97e-c7f825f39d25	8ba8388f-9907-486c-9883-3784c2f2f34e	content	\N	Alphabets A-E	completed	\N	480	2026-05-16	2026-05-22 00:16:15.625907
7520899d-9f93-40bd-b5bd-d2d56d28a487	fe400696-c6f1-4122-b97e-c7f825f39d25	8ba8388f-9907-486c-9883-3784c2f2f34e	quiz	\N	Vowels & Consonants Quiz	completed	90	300	2026-05-17	2026-05-22 00:16:15.628166
ccc3e287-a2aa-4c03-b704-287d6c2f7090	fe400696-c6f1-4122-b97e-c7f825f39d25	8ba8388f-9907-486c-9883-3784c2f2f34e	content	\N	Numbers 1-20	completed	\N	360	2026-05-18	2026-05-22 00:16:15.628802
79a6ce13-eb61-41ad-9f70-4dcc70487d9c	fe400696-c6f1-4122-b97e-c7f825f39d25	8ba8388f-9907-486c-9883-3784c2f2f34e	assignment	\N	Write your name	completed	85	600	2026-05-19	2026-05-22 00:16:15.629352
c5986c49-2a54-455d-94d6-84492da91672	fe400696-c6f1-4122-b97e-c7f825f39d25	8ba8388f-9907-486c-9883-3784c2f2f34e	content	\N	Colours & Shapes	completed	\N	420	2026-05-20	2026-05-22 00:16:15.630078
1e127a56-2f04-479e-9556-357c8394d49c	fe400696-c6f1-4122-b97e-c7f825f39d25	8ba8388f-9907-486c-9883-3784c2f2f34e	quiz	\N	Shapes Quiz	attempted	70	240	2026-05-21	2026-05-22 00:16:15.630635
614cdaf1-34b6-450c-9d36-0156316c8deb	fe400696-c6f1-4122-b97e-c7f825f39d25	8ba8388f-9907-486c-9883-3784c2f2f34e	content	\N	Fruits & Vegetables	completed	\N	300	2026-05-22	2026-05-22 00:16:15.630987
999689b7-faaf-4460-b728-f3b56dc68e87	cb09b4e0-9caf-46d2-92a5-ec65452200d4	8ba8388f-9907-486c-9883-3784c2f2f34e	content	\N	Addition & Subtraction	completed	\N	540	2026-05-16	2026-05-22 00:16:15.631274
f9990a25-bb97-4324-9932-750c2e5b051d	cb09b4e0-9caf-46d2-92a5-ec65452200d4	8ba8388f-9907-486c-9883-3784c2f2f34e	quiz	\N	Maths Quiz 1	completed	80	360	2026-05-17	2026-05-22 00:16:15.631595
234af1ba-33ac-45a9-8567-e0124681d7af	cb09b4e0-9caf-46d2-92a5-ec65452200d4	8ba8388f-9907-486c-9883-3784c2f2f34e	content	\N	Plants and Animals	completed	\N	420	2026-05-18	2026-05-22 00:16:15.63192
98810477-5496-4f5e-a621-ebb289e6e9ca	cb09b4e0-9caf-46d2-92a5-ec65452200d4	8ba8388f-9907-486c-9883-3784c2f2f34e	assignment	\N	Draw a plant	pending	\N	0	2026-05-19	2026-05-22 00:16:15.632203
18e1de44-58dd-450f-8713-d9fd81787b32	cb09b4e0-9caf-46d2-92a5-ec65452200d4	8ba8388f-9907-486c-9883-3784c2f2f34e	content	\N	Sentence Formation	completed	\N	300	2026-05-20	2026-05-22 00:16:15.632504
249afbc9-cc6e-457a-bf99-0c22cc7cac00	cb09b4e0-9caf-46d2-92a5-ec65452200d4	8ba8388f-9907-486c-9883-3784c2f2f34e	quiz	\N	English Grammar Quiz	completed	95	270	2026-05-21	2026-05-22 00:16:15.632834
6e2d4cf6-5b6b-409e-a2be-031b75fc693c	cb09b4e0-9caf-46d2-92a5-ec65452200d4	8ba8388f-9907-486c-9883-3784c2f2f34e	content	\N	Multiplication Basics	attempted	\N	180	2026-05-22	2026-05-22 00:16:15.633216
\.


--
-- Data for Name: student_analytics; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.student_analytics (id, student_id, organization_id, analytics_date, streak_days, consistency_score, attempted_count, not_attempted_count, completed_count, completion_rate, total_time_seconds, created_at, updated_at) FROM stdin;
698bf7cb-9cf3-4077-97d7-341285c0425f	fe400696-c6f1-4122-b97e-c7f825f39d25	8ba8388f-9907-486c-9883-3784c2f2f34e	2026-05-22	7	92.50	7	0	6	85.71	2700	2026-05-22 00:16:15.633535	2026-05-22 00:16:15.633535
9de2c1dd-3810-4a9e-b565-fb285abe0ed0	cb09b4e0-9caf-46d2-92a5-ec65452200d4	8ba8388f-9907-486c-9883-3784c2f2f34e	2026-05-22	5	78.30	6	0	5	83.33	2070	2026-05-22 00:16:15.633535	2026-05-22 00:16:15.633535
\.


--
-- Data for Name: student_attempts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.student_attempts (id, student_id, quiz_id, score, total_points, completed_at) FROM stdin;
f4cc0ed2-6935-4548-a5ed-f35a294092f4	866bc022-307f-4218-94a3-7622dd2aec79	f85700b3-faa3-4042-b8c4-c78a31a39610	6	60	2026-05-21 18:12:16.67867
73c69bb3-b346-478b-bd57-54bbc954a828	866bc022-307f-4218-94a3-7622dd2aec79	42848837-bd7f-4e3b-b558-2b2805b16192	1	10	2026-05-21 18:15:44.1855
eef2ebd0-1aac-439c-a30a-26c5c3580e5e	866bc022-307f-4218-94a3-7622dd2aec79	f85700b3-faa3-4042-b8c4-c78a31a39610	5	60	2026-05-21 19:02:27.489775
83b6390f-d34d-4c4b-81e0-0d836918eb31	866bc022-307f-4218-94a3-7622dd2aec79	f85700b3-faa3-4042-b8c4-c78a31a39610	6	60	2026-05-21 19:09:30.970763
854e80d3-c383-40d9-8fe7-5ba301b18f7b	866bc022-307f-4218-94a3-7622dd2aec79	f85700b3-faa3-4042-b8c4-c78a31a39610	5	60	2026-05-22 00:00:49.662455
11764a1e-63d4-4cbd-b075-f74091642a88	fe400696-c6f1-4122-b97e-c7f825f39d25	f85700b3-faa3-4042-b8c4-c78a31a39610	3	60	2026-05-22 00:39:26.5131
a29881ea-4bf1-4b22-8917-926912fe2fa6	fe400696-c6f1-4122-b97e-c7f825f39d25	f85700b3-faa3-4042-b8c4-c78a31a39610	3	60	2026-05-22 00:39:27.590161
5d4d8583-63c2-4249-a9d6-deb506efe6f8	fe400696-c6f1-4122-b97e-c7f825f39d25	42848837-bd7f-4e3b-b558-2b2805b16192	1	10	2026-05-22 00:39:34.971389
cf35dd45-991f-423d-a812-93f5c6deaceb	fe400696-c6f1-4122-b97e-c7f825f39d25	99f27629-ef10-4db4-badc-fcc19496503d	1	20	2026-05-22 00:39:47.383576
1d2c1421-4c1a-4951-b4d5-3d539cf5dca3	fe400696-c6f1-4122-b97e-c7f825f39d25	f85700b3-faa3-4042-b8c4-c78a31a39610	4	60	2026-05-22 00:43:30.083474
4fa3f654-336a-4863-a7ed-573feb96c060	fe400696-c6f1-4122-b97e-c7f825f39d25	f85700b3-faa3-4042-b8c4-c78a31a39610	6	60	2026-05-22 11:57:45.33923
6b902d83-4b09-4e74-8314-69f004935448	fe400696-c6f1-4122-b97e-c7f825f39d25	42848837-bd7f-4e3b-b558-2b2805b16192	1	10	2026-05-22 11:57:56.633132
8f1b259f-ba9e-4b7f-8e75-614db03c797d	d263eb62-0c0f-458b-bf31-654549c58655	b2afc6d9-df09-4405-8c36-cdff8f3b3b89	1	10	2026-05-22 16:13:19.241644
4b620fdd-b211-44fb-87da-8c56db597d5b	fe400696-c6f1-4122-b97e-c7f825f39d25	f85700b3-faa3-4042-b8c4-c78a31a39610	4	60	2026-05-22 17:34:41.853428
33f1440b-823e-4ed0-b9f5-285bbb3b43ec	fe400696-c6f1-4122-b97e-c7f825f39d25	99f27629-ef10-4db4-badc-fcc19496503d	2	20	2026-05-22 17:34:53.892313
fa5ea0ed-c34f-44c0-8cfe-bc60404ec71e	fe400696-c6f1-4122-b97e-c7f825f39d25	f85700b3-faa3-4042-b8c4-c78a31a39610	4	60	2026-05-22 17:48:47.504004
e26ca835-d8b0-43f6-95e3-e0b1be6f5483	d263eb62-0c0f-458b-bf31-654549c58655	9a4c3dfd-1f6a-4379-8bd3-790a95781aab	0	10	2026-05-23 14:53:05.135324
5acff8dc-baea-4f13-93fd-40d8e1495698	d263eb62-0c0f-458b-bf31-654549c58655	9a4c3dfd-1f6a-4379-8bd3-790a95781aab	0	10	2026-05-23 14:53:05.661201
ce460fc1-8022-41d7-833d-65eca83ca5bf	d263eb62-0c0f-458b-bf31-654549c58655	9a4c3dfd-1f6a-4379-8bd3-790a95781aab	0	10	2026-05-23 15:38:57.654735
2ba70364-54b0-4db7-a4c0-04b0f469a5c7	fe400696-c6f1-4122-b97e-c7f825f39d25	f85700b3-faa3-4042-b8c4-c78a31a39610	6	60	2026-05-24 12:30:48.742172
965880d6-aaed-4b9b-bc59-ada22c53d97c	fe400696-c6f1-4122-b97e-c7f825f39d25	42848837-bd7f-4e3b-b558-2b2805b16192	1	10	2026-05-24 12:48:15.043907
73688090-fbf4-4495-bcc1-988da24b8805	d263eb62-0c0f-458b-bf31-654549c58655	9a4c3dfd-1f6a-4379-8bd3-790a95781aab	0	10	2026-05-24 12:50:02.87999
715fdee9-1f7b-477c-9dfb-9bb65101d7f1	d263eb62-0c0f-458b-bf31-654549c58655	9a4c3dfd-1f6a-4379-8bd3-790a95781aab	0	10	2026-05-24 12:50:03.968834
2e1f5cb7-8a69-4a13-855d-864665e18922	fe400696-c6f1-4122-b97e-c7f825f39d25	f85700b3-faa3-4042-b8c4-c78a31a39610	5	60	2026-05-27 20:42:38.845845
835d9ac7-42cc-4b16-bb51-fcb9b52b396b	fe400696-c6f1-4122-b97e-c7f825f39d25	f85700b3-faa3-4042-b8c4-c78a31a39610	5	60	2026-05-28 00:34:38.439952
6a8cc402-9d64-4a63-afd9-ca570d10e969	fe400696-c6f1-4122-b97e-c7f825f39d25	922c6dcc-7ded-4249-9e8f-52b7f56d515e	2	20	2026-05-28 15:11:36.600657
e4f318ec-0255-4878-a35a-a2ad7bc62d34	fe400696-c6f1-4122-b97e-c7f825f39d25	42848837-bd7f-4e3b-b558-2b2805b16192	1	10	2026-05-28 15:57:56.763464
d5cfad8d-676d-4ea6-a737-56d309c72fe3	fe400696-c6f1-4122-b97e-c7f825f39d25	52edaca0-d62c-47cd-a587-6aeccd7eda7f	1	10	2026-05-28 23:37:00.144123
c1c2e89a-7729-4341-80d0-2c88871cfe9c	fe400696-c6f1-4122-b97e-c7f825f39d25	52edaca0-d62c-47cd-a587-6aeccd7eda7f	1	10	2026-05-28 23:41:44.143488
d278c06e-0823-4fb1-addd-ddb005c1e706	fe400696-c6f1-4122-b97e-c7f825f39d25	52edaca0-d62c-47cd-a587-6aeccd7eda7f	0	10	2026-05-29 00:02:02.035161
60ea725e-e3b6-4843-a305-e51e777f09ae	fe400696-c6f1-4122-b97e-c7f825f39d25	52edaca0-d62c-47cd-a587-6aeccd7eda7f	0	10	2026-05-29 00:05:30.519196
f313e257-1bb8-4c3e-abfb-cf51255454a6	fe400696-c6f1-4122-b97e-c7f825f39d25	52edaca0-d62c-47cd-a587-6aeccd7eda7f	0	10	2026-05-29 00:13:16.917196
31c7f9eb-7ef9-483d-9c79-5fec9af5ebc8	fe400696-c6f1-4122-b97e-c7f825f39d25	52edaca0-d62c-47cd-a587-6aeccd7eda7f	5	10	2026-05-29 00:23:03.323811
417cae2a-119c-42cb-a0da-6aee27c337e2	fe400696-c6f1-4122-b97e-c7f825f39d25	52edaca0-d62c-47cd-a587-6aeccd7eda7f	5	10	2026-05-29 00:29:27.401221
8b4dd6e6-063a-402e-a527-81070d8625ea	fe400696-c6f1-4122-b97e-c7f825f39d25	52edaca0-d62c-47cd-a587-6aeccd7eda7f	3	10	2026-05-29 00:58:45.008152
d744b99a-1723-4147-92f7-58e8cf563be7	fe400696-c6f1-4122-b97e-c7f825f39d25	d9ba92a0-cd24-493c-a7a4-be57a6755e61	0	10	2026-05-29 02:20:09.187517
f1980cb6-f39d-459f-a7bb-e420dc27ca46	fe400696-c6f1-4122-b97e-c7f825f39d25	d9ba92a0-cd24-493c-a7a4-be57a6755e61	1	10	2026-05-29 02:20:18.527628
33466de4-8562-4510-82de-ff38b5cb53a2	fe400696-c6f1-4122-b97e-c7f825f39d25	d9ba92a0-cd24-493c-a7a4-be57a6755e61	0	10	2026-05-29 02:22:36.964876
208260af-a925-43b2-96ba-0708b7d0881e	d263eb62-0c0f-458b-bf31-654549c58655	9e6f205f-b471-4400-9691-befa9cc13c9d	0	10	2026-05-29 02:25:11.951108
948375fd-069f-4e4d-be0a-9140ee9b652d	d263eb62-0c0f-458b-bf31-654549c58655	9e6f205f-b471-4400-9691-befa9cc13c9d	0	10	2026-05-29 02:25:12.983018
796725da-3551-4244-85d4-6bbfecc887f9	3d074d19-5d5d-46fa-b43c-9f1c9f257983	9e6f205f-b471-4400-9691-befa9cc13c9d	0	0	2026-05-29 12:41:53.469963
8b1ba156-668c-4f98-bf0e-e724b0a45a11	3d074d19-5d5d-46fa-b43c-9f1c9f257983	42848837-bd7f-4e3b-b558-2b2805b16192	10	10	2026-05-29 12:42:05.746639
2e1d87f2-c996-4d79-a272-3226e4a4ec9a	fe400696-c6f1-4122-b97e-c7f825f39d25	52edaca0-d62c-47cd-a587-6aeccd7eda7f	0	0	2026-05-29 14:42:19.91784
46be96bb-3c4e-447b-8e62-15d57154aa7c	fe400696-c6f1-4122-b97e-c7f825f39d25	d9ba92a0-cd24-493c-a7a4-be57a6755e61	0	0	2026-05-29 14:42:57.303443
035ce6a4-1b6f-4648-9318-e1f44afe8b1f	fe400696-c6f1-4122-b97e-c7f825f39d25	d9ba92a0-cd24-493c-a7a4-be57a6755e61	0	0	2026-05-29 14:43:04.850708
961602f7-4927-4ee9-82b6-045107b8942c	fe400696-c6f1-4122-b97e-c7f825f39d25	fa7a6f0c-1a53-4f15-bb9d-cc162985a33c	0	0	2026-05-29 16:32:14.628933
6ec04e51-4fca-4a2a-9458-bf5443936ed5	fe400696-c6f1-4122-b97e-c7f825f39d25	fa7a6f0c-1a53-4f15-bb9d-cc162985a33c	0	0	2026-05-29 17:06:28.660662
7831cf28-4835-4460-b6d0-c606d227b32f	313b3836-dd4c-4bab-8ca1-387b05062ea7	a1b3d3c5-157f-4f6b-9eb8-9a4101f86b64	60	60	2026-05-29 19:08:58.479086
7791fdb6-bfde-4989-9b67-0b14d38a2634	313b3836-dd4c-4bab-8ca1-387b05062ea7	a1b3d3c5-157f-4f6b-9eb8-9a4101f86b64	60	60	2026-05-29 19:36:23.192664
7f0a8701-d2d2-4241-8cee-83d3eb92e38a	313b3836-dd4c-4bab-8ca1-387b05062ea7	a1b3d3c5-157f-4f6b-9eb8-9a4101f86b64	35	60	2026-05-29 19:38:19.222896
0490ef1b-1ebf-4ce8-8291-1d1de6889030	313b3836-dd4c-4bab-8ca1-387b05062ea7	f1b6e4e0-169e-4f32-a796-bd3abfdb1265	50	60	2026-05-29 19:44:54.833366
3fa229d0-1a67-45bf-bcc3-eaf5337c4140	313b3836-dd4c-4bab-8ca1-387b05062ea7	5ee076f6-30af-466e-be8c-845ec6c3fe16	60	60	2026-05-29 20:04:44.174067
2a427bb2-5af2-48b4-a021-43795b0c8454	313b3836-dd4c-4bab-8ca1-387b05062ea7	2be08575-5987-4255-9881-20cf6250be1b	60	60	2026-05-29 20:18:00.478883
c0f9cdbd-2a76-471c-b3a2-ad0173eaf7fe	313b3836-dd4c-4bab-8ca1-387b05062ea7	5ee076f6-30af-466e-be8c-845ec6c3fe16	60	60	2026-05-29 20:18:36.354105
855cadd2-0212-491a-a046-96a6c4513a34	313b3836-dd4c-4bab-8ca1-387b05062ea7	f1b6e4e0-169e-4f32-a796-bd3abfdb1265	60	60	2026-05-29 20:19:36.924079
d1e00a08-9bde-4942-8b2a-1fedc99adcb8	313b3836-dd4c-4bab-8ca1-387b05062ea7	45578aba-3bad-41e4-bbf3-c7a3de764105	60	60	2026-05-29 20:20:21.208415
58485f2e-3849-4502-8eff-49242b312689	313b3836-dd4c-4bab-8ca1-387b05062ea7	9675eec6-48bd-4f79-a82f-43b112d81259	65	65	2026-05-29 20:21:45.221951
0744f3ff-c7ae-447e-8788-fd52c91f408d	313b3836-dd4c-4bab-8ca1-387b05062ea7	9675eec6-48bd-4f79-a82f-43b112d81259	50	65	2026-05-29 20:32:15.255242
4567c71e-ac36-4fa3-b800-9ed10e79022e	313b3836-dd4c-4bab-8ca1-387b05062ea7	87da913a-7c5f-4b8c-9b05-ba8589a8c745	50	65	2026-05-29 20:33:06.327707
b7891cac-717c-4292-bb58-0d39b3ac8d15	313b3836-dd4c-4bab-8ca1-387b05062ea7	87da913a-7c5f-4b8c-9b05-ba8589a8c745	30	65	2026-05-29 20:58:01.819916
45d56112-4d30-4a32-83e7-a88e7602862b	313b3836-dd4c-4bab-8ca1-387b05062ea7	8a970f86-cf49-4930-9f82-8130fdf6440f	30	30	2026-05-29 21:41:29.333504
\.


--
-- Data for Name: subjects; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.subjects (id, organization_id, cover_image, title, description, author, author_user_id, is_external_author, class_level, created_at, updated_at, icon_image, icon_bg_color) FROM stdin;
b18855f0-be45-4f9a-9ae5-09163ec23733	e1811769-e50e-4b03-be07-16f0057b5749	\N	Hindi	Hindi language development in reading, writing, and speaking.	ELS Team	\N	t	3	2026-05-29 15:47:35.617727	2026-05-29 17:01:02.359373	symbol:languages	#EDE4FF
c919bf64-8085-48b2-9125-54119ed86611	e1811769-e50e-4b03-be07-16f0057b5749	\N	Computer Science	Basic computer awareness, digital tools, and safe technology use.	ELS Team	\N	t	1	2026-05-29 15:47:35.610222	2026-05-29 17:01:02.345722	symbol:monitor	#E0F2FE
aeddab9d-cee3-427c-8a04-21c03d934e07	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	Hindi Stories	हिंदी कहानिया  panch tantra	\N	\N	f	3	2026-05-22 13:28:41.630766	2026-05-22 13:28:41.630766	\N	\N
d4cb8266-0b46-4781-a722-6d7c1943f85b	e1811769-e50e-4b03-be07-16f0057b5749	\N	English	Reading, writing, vocabulary, and communication practice.	ELS Team	\N	t	2	2026-05-29 15:47:35.611276	2026-05-29 17:01:02.347011	symbol:book-open	#D6EAFF
d50eefff-e00e-412e-a913-70e3ee4fa14b	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	Extracurricular Activities	Extracurricular Activities	\N	\N	f	LKG	2026-05-29 14:47:06.645682	2026-05-29 14:48:50.195446	\N	\N
dc9e4653-e25b-408a-ac10-32fc8333082c	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	Hindi	Hindi	\N	\N	f	LKG	2026-05-29 14:53:09.052178	2026-05-29 14:53:09.052178	\N	\N
ce41342d-0d59-4142-b848-415149eb6a6b	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	GK	General Awareness (GK)	\N	\N	f	LKG	2026-05-29 14:46:36.381492	2026-05-29 14:56:07.201007	\N	\N
a1e7e288-bfbd-4fd4-aae3-2dc84e9a373b	e1811769-e50e-4b03-be07-16f0057b5749	\N	Mathematics	Arithmetic, number operations, and logical reasoning.	ELS Team	\N	t	2	2026-05-29 15:47:35.612146	2026-05-29 17:01:02.351082	symbol:hash	#FFE8D6
d2b6db83-9545-4375-bc14-a74ebc0cb9c9	e1811769-e50e-4b03-be07-16f0057b5749	\N	Environmental Studies (EVS)	Integrated learning of natural and social surroundings.	ELS Team	\N	t	2	2026-05-29 15:47:35.612908	2026-05-29 17:01:02.352128	symbol:leaf	#D6F5D6
1bfb7cf5-bd0d-491d-9e61-d8b2600cc2eb	e1811769-e50e-4b03-be07-16f0057b5749	\N	General Knowledge	General awareness about people, places, and the world.	ELS Team	\N	t	3	2026-05-29 15:47:35.618708	2026-05-29 17:01:02.360276	symbol:globe	#FFF5CC
7bf1f600-835f-41fc-afb3-acd45772973a	e1811769-e50e-4b03-be07-16f0057b5749	\N	Computer Science	Basic computer awareness, digital tools, and safe technology use.	ELS Team	\N	t	3	2026-05-29 15:47:35.619376	2026-05-29 17:01:02.361164	symbol:monitor	#E0F2FE
a42db576-afbe-4d17-9588-5a3c8cb91dae	e1811769-e50e-4b03-be07-16f0057b5749	\N	English	Reading, writing, vocabulary, and communication practice.	ELS Team	\N	t	4	2026-05-29 15:47:35.620054	2026-05-29 17:01:02.361816	symbol:book-open	#D6EAFF
fac34128-f359-4caf-b238-63ca697a4c3a	e1811769-e50e-4b03-be07-16f0057b5749	\N	Hindi	Hindi language development in reading, writing, and speaking.	ELS Team	\N	t	2	2026-05-29 15:47:35.613538	2026-05-29 17:01:02.353035	symbol:languages	#EDE4FF
92ccee36-3cc7-4376-b3a0-9aa8f59c4662	e1811769-e50e-4b03-be07-16f0057b5749	\N	Mathematics	Arithmetic, number operations, and logical reasoning.	ELS Team	\N	t	4	2026-05-29 15:47:35.620583	2026-05-29 17:01:02.362372	symbol:hash	#FFE8D6
0ff49df0-5dc1-4fb5-b8cf-80d32b0fc560	e1811769-e50e-4b03-be07-16f0057b5749	\N	English	Reading, writing, vocabulary, and communication practice.	ELS Team	\N	t	1	2026-05-29 15:47:35.603304	2026-05-29 17:01:02.337352	symbol:book-open	#D6EAFF
ebf93a03-335c-4c03-9ae0-56f2a302c24a	e1811769-e50e-4b03-be07-16f0057b5749	\N	Mathematics	Arithmetic, number operations, and logical reasoning.	ELS Team	\N	t	1	2026-05-29 15:47:35.604756	2026-05-29 17:01:02.340318	symbol:hash	#FFE8D6
7c9c13df-72f6-46b3-88c7-95ee523ead46	e1811769-e50e-4b03-be07-16f0057b5749	\N	Environmental Studies (EVS)	Integrated learning of natural and social surroundings.	ELS Team	\N	t	1	2026-05-29 15:47:35.605774	2026-05-29 17:01:02.342416	symbol:leaf	#D6F5D6
943e74b3-9da3-43cc-be37-b3b8679a97d2	e1811769-e50e-4b03-be07-16f0057b5749	\N	Hindi	Hindi language development in reading, writing, and speaking.	ELS Team	\N	t	1	2026-05-29 15:47:35.606949	2026-05-29 17:01:02.343798	symbol:languages	#EDE4FF
c59c5050-a6d9-4030-8fcf-fea76e8e983d	e1811769-e50e-4b03-be07-16f0057b5749	\N	General Knowledge	General awareness about people, places, and the world.	ELS Team	\N	t	1	2026-05-29 15:47:35.608512	2026-05-29 17:01:02.344824	symbol:globe	#FFF5CC
f6f56b6c-c22c-400f-8c5e-328b9833c234	e1811769-e50e-4b03-be07-16f0057b5749	\N	General Knowledge	General awareness about people, places, and the world.	ELS Team	\N	t	2	2026-05-29 15:47:35.614035	2026-05-29 17:01:02.353852	symbol:globe	#FFF5CC
187c5a2d-5d70-4f6b-a5f0-1e38855e9306	e1811769-e50e-4b03-be07-16f0057b5749	\N	Computer Science	Basic computer awareness, digital tools, and safe technology use.	ELS Team	\N	t	2	2026-05-29 15:47:35.614654	2026-05-29 17:01:02.354689	symbol:monitor	#E0F2FE
22ed6504-a8c1-4c9a-b7bb-5cb68ce8ecce	e1811769-e50e-4b03-be07-16f0057b5749	\N	English	Reading, writing, vocabulary, and communication practice.	ELS Team	\N	t	3	2026-05-29 15:47:35.615309	2026-05-29 17:01:02.356131	symbol:book-open	#D6EAFF
8873dd59-f2eb-45e3-bd54-8565dbdf1bef	e1811769-e50e-4b03-be07-16f0057b5749	\N	Environmental Studies (EVS)	Integrated learning of natural and social surroundings.	ELS Team	\N	t	4	2026-05-29 15:47:35.621113	2026-05-29 17:01:02.362921	symbol:leaf	#D6F5D6
51454255-00a2-4890-b793-7b1986438d11	e1811769-e50e-4b03-be07-16f0057b5749	\N	Social Science	History, civics, geography, and societal understanding.	ELS Team	\N	t	6	2026-05-29 15:47:35.62697	2026-05-29 17:01:02.371484	symbol:globe	#FFF5CC
188c426d-2fbe-4993-a588-dd5cceaf8a60	e1811769-e50e-4b03-be07-16f0057b5749	\N	Hindi	Advanced Hindi language and literature fundamentals.	ELS Team	\N	t	6	2026-05-29 15:47:35.627407	2026-05-29 17:01:02.372932	symbol:languages	#EDE4FF
2797303a-0464-4c96-8a05-a32765bd4829	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	English	Foundational language skills for listening, speaking, and early literacy.	\N	\N	f	LKG	2026-05-29 14:53:30.700453	2026-05-29 17:01:02.431073	symbol:book-open	#D6EAFF
7c08a847-95f9-4eb8-b740-01d9c00ea034	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	Mathematics	Number sense, counting, and early problem-solving activities.	\N	\N	f	LKG	2026-05-29 14:46:09.749543	2026-05-29 17:01:02.431322	symbol:hash	#FFE8D6
dcc3159b-d82f-418f-a846-6d704f372bf3	e1811769-e50e-4b03-be07-16f0057b5749	\N	Mathematics	Arithmetic, number operations, and logical reasoning.	ELS Team	\N	t	3	2026-05-29 15:47:35.615945	2026-05-29 17:01:02.357529	symbol:hash	#FFE8D6
b008de43-cea2-492f-b875-98d605955da3	e1811769-e50e-4b03-be07-16f0057b5749	\N	Environmental Studies (EVS)	Integrated learning of natural and social surroundings.	ELS Team	\N	t	3	2026-05-29 15:47:35.617049	2026-05-29 17:01:02.358567	symbol:leaf	#D6F5D6
d3392817-dd7c-4f6e-97fa-9dba090771ff	e1811769-e50e-4b03-be07-16f0057b5749	\N	Hindi	Advanced Hindi language and literature fundamentals.	ELS Team	\N	t	8	2026-05-29 15:47:35.642567	2026-05-29 17:01:02.380633	symbol:languages	#EDE4FF
4c550081-a714-4a8d-a0db-0d91b6a77ac8	e1811769-e50e-4b03-be07-16f0057b5749	\N	Sanskrit	Introductory Sanskrit language and grammar foundations.	ELS Team	\N	t	8	2026-05-29 15:47:35.64334	2026-05-29 17:01:02.381035	symbol:languages	#EDE4FF
06400460-7933-45f4-b43a-9d5caa516dae	e1811769-e50e-4b03-be07-16f0057b5749	\N	Computer Applications / IT	Information technology and practical computer applications.	ELS Team	\N	t	9	2026-05-29 15:47:35.646167	2026-05-29 17:01:02.383779	symbol:monitor	#E0F2FE
fa9b80fa-49f5-4b9f-befc-3f4154796dde	e1811769-e50e-4b03-be07-16f0057b5749	\N	English	Language proficiency, literature appreciation, and writing skills.	ELS Team	\N	t	10	2026-05-29 15:47:35.646503	2026-05-29 17:01:02.384171	symbol:book-open	#D6EAFF
d243d074-0678-4500-bb31-f73084ff4e4c	e1811769-e50e-4b03-be07-16f0057b5749	\N	Computer Science	Digital literacy, basic coding ideas, and computer applications.	ELS Team	\N	t	6	2026-05-29 15:47:35.630109	2026-05-29 17:01:02.373978	symbol:monitor	#E0F2FE
1d9fe802-6b10-41b5-a403-901dc5f12239	e1811769-e50e-4b03-be07-16f0057b5749	\N	English	Comprehension, grammar, writing skills, and communication.	ELS Team	\N	t	7	2026-05-29 15:47:35.630672	2026-05-29 17:01:02.374431	symbol:book-open	#D6EAFF
b527ffab-c03a-4c41-9529-6fc5d03854c5	e1811769-e50e-4b03-be07-16f0057b5749	\N	Hindi	Advanced Hindi language and literature fundamentals.	ELS Team	\N	t	7	2026-05-29 15:47:35.639461	2026-05-29 17:01:02.376309	symbol:languages	#EDE4FF
84927a53-5b02-498f-a4ba-8362235a02ed	e1811769-e50e-4b03-be07-16f0057b5749	\N	Mathematics	Algebra, geometry, mensuration, and problem-solving.	ELS Team	\N	t	10	2026-05-29 15:47:35.64684	2026-05-29 17:01:02.384552	symbol:hash	#FFE8D6
c673cda7-279e-4b6b-b0da-1d030bb2e9b0	e1811769-e50e-4b03-be07-16f0057b5749	\N	Science (Physics, Chemistry, Biology)	Integrated science with conceptual and practical understanding.	ELS Team	\N	t	10	2026-05-29 15:47:35.647194	2026-05-29 17:01:02.384927	symbol:flask	#D6F5D6
5ec3909e-6f19-4fbf-9a8a-e2102f57c7df	e1811769-e50e-4b03-be07-16f0057b5749	\N	Hindi	Hindi language and literature for senior middle school levels.	ELS Team	\N	t	10	2026-05-29 15:47:35.647844	2026-05-29 17:01:02.385996	symbol:languages	#EDE4FF
d2f95a57-fc88-42a7-9473-c3ae07132eeb	e1811769-e50e-4b03-be07-16f0057b5749	\N	Computer Applications / IT	Information technology and practical computer applications.	ELS Team	\N	t	10	2026-05-29 15:47:35.64816	2026-05-29 17:01:02.386416	symbol:monitor	#E0F2FE
1fb8ea3c-a342-4d12-a521-058b221738fb	e1811769-e50e-4b03-be07-16f0057b5749	\N	Physics	Fundamentals of mechanics, waves, electricity, and modern physics.	ELS Team	\N	t	11	2026-05-29 15:47:35.648475	2026-05-29 17:01:02.386752	symbol:flask	#D6F5D6
34eb1c10-c060-4abf-9048-0871103b97ca	e1811769-e50e-4b03-be07-16f0057b5749	\N	Chemistry	Atomic structure, reactions, bonding, and chemical principles.	ELS Team	\N	t	11	2026-05-29 15:47:35.648912	2026-05-29 17:01:02.387154	symbol:flask	#D6F5D6
979e0812-a8d9-4b44-84e6-9bd25f5327a8	e1811769-e50e-4b03-be07-16f0057b5749	\N	Mathematics	Advanced algebra, calculus, trigonometry, and applications.	ELS Team	\N	t	11	2026-05-29 15:47:35.649337	2026-05-29 17:01:02.38756	symbol:hash	#FFE8D6
5a8e34cb-8cde-4cd2-9f9c-19bfed7a1be6	e1811769-e50e-4b03-be07-16f0057b5749	\N	Sanskrit	Introductory Sanskrit language and grammar foundations.	ELS Team	\N	t	7	2026-05-29 15:47:35.63989	2026-05-29 17:01:02.37756	symbol:languages	#EDE4FF
74f9180c-9d94-4131-a572-fa113ce54776	e1811769-e50e-4b03-be07-16f0057b5749	\N	Computer Science	Digital literacy, basic coding ideas, and computer applications.	ELS Team	\N	t	7	2026-05-29 15:47:35.640319	2026-05-29 17:01:02.378154	symbol:monitor	#E0F2FE
d21b6090-afd6-4ada-9755-35b7ed6d21e8	e1811769-e50e-4b03-be07-16f0057b5749	\N	Biology	Life sciences including botany, zoology, and human biology.	ELS Team	\N	t	11	2026-05-29 15:47:35.649724	2026-05-29 17:01:02.387985	symbol:leaf	#D6F5D6
f63982a4-c79a-421e-9089-99f427387a54	e1811769-e50e-4b03-be07-16f0057b5749	\N	Computer Science	Programming, computational thinking, and computer systems.	ELS Team	\N	t	11	2026-05-29 15:47:35.650121	2026-05-29 17:01:02.388344	symbol:monitor	#E0F2FE
1122e14f-0071-455e-ba20-476dcd31062f	e1811769-e50e-4b03-be07-16f0057b5749	\N	English	Comprehension, grammar, writing skills, and communication.	ELS Team	\N	t	8	2026-05-29 15:47:35.640726	2026-05-29 17:01:02.378672	symbol:book-open	#D6EAFF
24164dac-787b-4d0f-ac4b-16973bae14ca	e1811769-e50e-4b03-be07-16f0057b5749	\N	Mathematics	Core math concepts including algebraic and numerical reasoning.	ELS Team	\N	t	8	2026-05-29 15:47:35.641127	2026-05-29 17:01:02.379203	symbol:hash	#FFE8D6
d0cf5781-b6b8-4460-9cf3-f633d3390939	e1811769-e50e-4b03-be07-16f0057b5749	\N	Science	General science concepts with observation and experimentation.	ELS Team	\N	t	8	2026-05-29 15:47:35.641523	2026-05-29 17:01:02.379718	symbol:flask	#D6F5D6
6be3f2ce-6ef5-4746-9fe7-9eac40f10b9c	e1811769-e50e-4b03-be07-16f0057b5749	\N	Social Science	History, civics, geography, and societal understanding.	ELS Team	\N	t	8	2026-05-29 15:47:35.641911	2026-05-29 17:01:02.38018	symbol:globe	#FFF5CC
a7c8e712-4ef5-4451-8aa1-c30f82a36351	e1811769-e50e-4b03-be07-16f0057b5749	\N	Accountancy	Accounting principles, bookkeeping, and financial statements.	ELS Team	\N	t	11	2026-05-29 15:47:35.650492	2026-05-29 17:01:02.388688	symbol:hash	#FFE8D6
b93372a0-bbfd-41c1-893d-1ffbd764452a	e1811769-e50e-4b03-be07-16f0057b5749	\N	Environmental Studies	Awareness of surroundings, nature, and everyday life concepts.	ELS Team	\N	t	UKG	2026-05-29 15:47:35.661229	2026-05-29 17:01:02.399768	symbol:leaf	#D6F5D6
b2186f36-d1fe-43d2-9ebb-c0753271fd43	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	Hindi	Hindi language development in reading, writing, and speaking.	ELS Team	\N	t	1	2026-05-29 15:47:35.663895	2026-05-29 17:01:02.402289	symbol:languages	#EDE4FF
6c562093-4e3f-4913-92ee-158e35a1bb9a	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	General Knowledge	General awareness about people, places, and the world.	ELS Team	\N	t	1	2026-05-29 15:47:35.664263	2026-05-29 17:01:02.402636	symbol:globe	#FFF5CC
f84752d7-8af4-4cc5-9745-b569cbaf386b	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	Computer Science	Basic computer awareness, digital tools, and safe technology use.	ELS Team	\N	t	1	2026-05-29 15:47:35.664637	2026-05-29 17:01:02.402967	symbol:monitor	#E0F2FE
61f7c109-8530-4d31-b7f1-399d708e5ed9	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	English	Reading, writing, vocabulary, and communication practice.	ELS Team	\N	t	2	2026-05-29 15:47:35.665016	2026-05-29 17:01:02.40336	symbol:book-open	#D6EAFF
c2e10612-558d-4f7b-978c-fb2abdf7d1f4	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	Mathematics	Arithmetic, number operations, and logical reasoning.	ELS Team	\N	t	2	2026-05-21 17:32:02.250996	2026-05-29 17:01:02.403677	symbol:hash	#FFE8D6
77bbb81a-62c0-4aa6-ad8a-bbd7521f19eb	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	Environmental Studies (EVS)	Integrated learning of natural and social surroundings.	ELS Team	\N	t	2	2026-05-29 15:47:35.665783	2026-05-29 17:01:02.403989	symbol:leaf	#D6F5D6
0ff13066-6be8-4db9-8c92-fb5dd4a70e7d	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	Hindi	Hindi language development in reading, writing, and speaking.	ELS Team	\N	t	2	2026-05-29 15:47:35.66632	2026-05-29 17:01:02.404296	symbol:languages	#EDE4FF
d4460a87-323b-453d-be10-4d85a44da03e	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	General Knowledge	General awareness about people, places, and the world.	ELS Team	\N	t	2	2026-05-29 15:47:35.666683	2026-05-29 17:01:02.404602	symbol:globe	#FFF5CC
023995fd-aa1c-4c11-b128-7e52e1f48952	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	Computer Science	Basic computer awareness, digital tools, and safe technology use.	ELS Team	\N	t	2	2026-05-29 15:47:35.667095	2026-05-29 17:01:02.404919	symbol:monitor	#E0F2FE
46146236-1ca9-44d2-876d-a969dca6e3e0	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	English	Reading, writing, vocabulary, and communication practice.	ELS Team	\N	t	3	2026-05-29 15:47:35.667474	2026-05-29 17:01:02.405246	symbol:book-open	#D6EAFF
ce67a922-85af-45fc-b6fb-7c01e7cba27e	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	Mathematics	Arithmetic, number operations, and logical reasoning.	ELS Team	\N	t	3	2026-05-29 15:47:35.667811	2026-05-29 17:01:02.405566	symbol:hash	#FFE8D6
a704d7bb-5fd5-4ee5-8956-635fa5f349dd	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	Geography	Physical and human geography, maps, and environmental systems.	ELS Team	\N	t	11	2026-05-29 15:47:35.686287	2026-05-29 17:01:02.42646	symbol:globe	#FFF5CC
6cfba8ae-9bd0-4eb5-8b69-2b79f82eb164	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	Environmental Studies (EVS)	Integrated learning of natural and social surroundings.	ELS Team	\N	t	4	2026-05-29 15:47:35.670158	2026-05-29 17:01:02.407699	symbol:leaf	#D6F5D6
621add2d-b223-451a-9767-f0b4d8b977e6	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	English	Language proficiency, literature appreciation, and writing skills.	ELS Team	\N	t	9	2026-05-29 15:47:35.679499	2026-05-29 17:01:02.419389	symbol:book-open	#D6EAFF
dffe87a3-85fa-4aae-a8a1-ceb79e2d3ac3	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	Mathematics	Algebra, geometry, mensuration, and problem-solving.	ELS Team	\N	t	9	2026-05-29 15:47:35.67977	2026-05-29 17:01:02.419761	symbol:hash	#FFE8D6
94af1626-5828-4bd9-9a5a-e52c91ec52f9	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	Science (Physics, Chemistry, Biology)	Integrated science with conceptual and practical understanding.	ELS Team	\N	t	9	2026-05-29 15:47:35.680029	2026-05-29 17:01:02.420081	symbol:flask	#D6F5D6
65427ad5-9980-4270-b535-ed09ea4c5fe2	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	Computer Science	Digital literacy, basic coding ideas, and computer applications.	ELS Team	\N	t	6	2026-05-29 15:47:35.675209	2026-05-29 17:01:02.414377	symbol:monitor	#E0F2FE
38bf7643-8aa5-47c4-82ac-f071acef3571	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	English	Comprehension, grammar, writing skills, and communication.	ELS Team	\N	t	7	2026-05-29 15:47:35.675483	2026-05-29 17:01:02.414669	symbol:book-open	#D6EAFF
02fa6dbc-b823-4d5c-9e77-843a76371c56	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	Hindi	Hindi language development in reading, writing, and speaking.	ELS Team	\N	t	4	2026-05-29 15:47:35.6705	2026-05-29 17:01:02.408009	symbol:languages	#EDE4FF
5c7c4fac-1b1f-4eb1-9a42-e76d67e5fa66	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	Computer Science	Digital literacy, basic coding ideas, and computer applications.	ELS Team	\N	t	7	2026-05-29 15:47:35.677219	2026-05-29 17:01:02.416695	symbol:monitor	#E0F2FE
df503c76-8ff4-46a6-ad70-a293496bed54	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	General Knowledge	General awareness about people, places, and the world.	ELS Team	\N	t	4	2026-05-29 15:47:35.670853	2026-05-29 17:01:02.408315	symbol:globe	#FFF5CC
08a35f50-db22-470d-b793-7a6b78cbb809	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	Social Science	History, geography, political science, and economics basics.	ELS Team	\N	t	9	2026-05-29 15:47:35.680308	2026-05-29 17:01:02.420367	symbol:globe	#FFF5CC
356caf40-324f-4b55-a32b-8abb209e35f2	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	Computer Science	Basic computer awareness, digital tools, and safe technology use.	ELS Team	\N	t	4	2026-05-29 15:47:35.67117	2026-05-29 17:01:02.408638	symbol:monitor	#E0F2FE
c18b4f93-da05-4856-b4b3-de4c514b271a	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	English	Reading, writing, vocabulary, and communication practice.	ELS Team	\N	t	5	2026-05-29 15:47:35.671482	2026-05-29 17:01:02.408948	symbol:book-open	#D6EAFF
4254ab39-55a9-4e87-af2e-7961ed880f4f	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	Mathematics	Arithmetic, number operations, and logical reasoning.	ELS Team	\N	t	5	2026-05-29 15:47:35.671791	2026-05-29 17:01:02.409251	symbol:hash	#FFE8D6
71416f26-dc28-4a4a-89b9-671e8cac431c	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	Mathematics	Core math concepts including algebraic and numerical reasoning.	ELS Team	\N	t	6	2026-05-29 15:47:35.673694	2026-05-29 17:01:02.412858	symbol:hash	#FFE8D6
79e3da32-c7e6-4643-b681-573193fa89f9	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	Science	General science concepts with observation and experimentation.	ELS Team	\N	t	6	2026-05-29 15:47:35.673996	2026-05-29 17:01:02.413165	symbol:flask	#D6F5D6
463975c8-7258-43a0-8c99-e9983ceb1758	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	Computer Science	Basic computer awareness, digital tools, and safe technology use.	ELS Team	\N	t	3	2026-05-29 15:47:35.669171	2026-05-29 17:01:02.406772	symbol:monitor	#E0F2FE
7affcce0-4b3a-4e72-ad80-41360a39db3a	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	English	Reading, writing, vocabulary, and communication practice.	ELS Team	\N	t	4	2026-05-29 15:47:35.669475	2026-05-29 17:01:02.407084	symbol:book-open	#D6EAFF
cd517f2c-9be4-4ee9-bd90-be07a128a6af	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	Mathematics	Arithmetic, number operations, and logical reasoning.	ELS Team	\N	t	4	2026-05-29 15:47:35.669809	2026-05-29 17:01:02.40739	symbol:hash	#FFE8D6
2471ed09-d4d6-4669-aef9-421a265c25db	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	Social Science	History, civics, geography, and societal understanding.	ELS Team	\N	t	6	2026-05-29 15:47:35.674301	2026-05-29 17:01:02.413467	symbol:globe	#FFF5CC
cbc1c9bd-1080-4e5d-85aa-674d305fedad	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	Hindi	Advanced Hindi language and literature fundamentals.	ELS Team	\N	t	6	2026-05-29 15:47:35.674602	2026-05-29 17:01:02.413758	symbol:languages	#EDE4FF
ed99b14b-0944-466d-ac9d-27a6918e9c64	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	English	Comprehension, grammar, writing skills, and communication.	ELS Team	\N	t	8	2026-05-29 15:47:35.677469	2026-05-29 17:01:02.417028	symbol:book-open	#D6EAFF
cc4f0635-3ac5-43bb-a93f-8707da071e35	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	Mathematics	Core math concepts including algebraic and numerical reasoning.	ELS Team	\N	t	8	2026-05-29 15:47:35.677734	2026-05-29 17:01:02.417353	symbol:hash	#FFE8D6
eb62a1c9-cadf-4ce9-8f43-90a721f18136	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	Science	General science concepts with observation and experimentation.	ELS Team	\N	t	8	2026-05-29 15:47:35.67799	2026-05-29 17:01:02.417693	symbol:flask	#D6F5D6
b2bfba71-9ca5-4704-a04d-131bf80c599d	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	Social Science	History, civics, geography, and societal understanding.	ELS Team	\N	t	8	2026-05-29 15:47:35.678241	2026-05-29 17:01:02.418027	symbol:globe	#FFF5CC
d36b44d2-49f4-45b0-ac8a-7b2783f47bd9	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	Hindi	Advanced Hindi language and literature fundamentals.	ELS Team	\N	t	8	2026-05-29 15:47:35.678489	2026-05-29 17:01:02.418338	symbol:languages	#EDE4FF
cd8e00e4-59ae-472b-8407-48c5e52c0e9e	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	Sanskrit	Introductory Sanskrit language and grammar foundations.	ELS Team	\N	t	8	2026-05-29 15:47:35.678767	2026-05-29 17:01:02.418656	symbol:languages	#EDE4FF
9f4c5a6f-9eec-4276-9996-9f11d0e746b0	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	Computer Science	Digital literacy, basic coding ideas, and computer applications.	ELS Team	\N	t	8	2026-05-29 15:47:35.679235	2026-05-29 17:01:02.419021	symbol:monitor	#E0F2FE
4cacd6cf-6d82-48ad-aa23-c6d92e82267e	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	Psychology	Introduction to human behavior, cognition, and mental processes.	ELS Team	\N	t	11	2026-05-29 15:47:35.686544	2026-05-29 17:01:02.426739	symbol:sparkles	#EDE4FF
00fc2f66-3d03-44ea-8fd9-24ee7d52cfee	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	English	Advanced language, literature, and communication competence.	ELS Team	\N	t	11	2026-05-29 15:47:35.6868	2026-05-29 17:01:02.427245	symbol:book-open	#D6EAFF
a8829448-4945-4f92-9c49-cb89f4b56a1d	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	Biology	Life sciences including botany, zoology, and human biology.	ELS Team	\N	t	12	2026-05-29 15:47:35.687858	2026-05-29 17:01:02.428569	symbol:leaf	#D6F5D6
0993accf-90a3-4b93-a726-36683a5958db	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	Computer Science	Programming, computational thinking, and computer systems.	ELS Team	\N	t	12	2026-05-29 15:47:35.688125	2026-05-29 17:01:02.428811	symbol:monitor	#E0F2FE
6e9f55ff-3f0c-4f2f-85e6-5a4c283cf749	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	Hindi	Hindi language and literature for senior middle school levels.	ELS Team	\N	t	10	2026-05-29 15:47:35.682608	2026-05-29 17:01:02.422603	symbol:languages	#EDE4FF
4c912acb-396f-4d81-a907-e794c8cea28d	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	Computer Applications / IT	Information technology and practical computer applications.	ELS Team	\N	t	10	2026-05-29 15:47:35.682888	2026-05-29 17:01:02.422912	symbol:monitor	#E0F2FE
11c7969d-0a7d-456e-abbc-1dc8647842d5	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	Rhymes & Stories	Songs, rhymes, and storytelling to build language rhythm and imagination.	ELS Team	\N	t	LKG	2026-05-29 15:47:35.691559	2026-05-29 17:01:02.431831	symbol:sparkles	#EDE4FF
10991b5b-12c3-413c-b469-3032224c24b9	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	Accountancy	Accounting principles, bookkeeping, and financial statements.	ELS Team	\N	t	12	2026-05-29 15:47:35.68839	2026-05-29 17:01:02.429045	symbol:hash	#FFE8D6
fb36ae14-6b07-48fa-8c73-a7506bde9926	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	Physics	Fundamentals of mechanics, waves, electricity, and modern physics.	ELS Team	\N	t	11	2026-05-29 15:47:35.683507	2026-05-29 17:01:02.423225	symbol:flask	#D6F5D6
0854fb40-0689-4f6f-9947-e21bb9fc2f8a	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	Business Studies	Business organization, management, and entrepreneurship basics.	ELS Team	\N	t	12	2026-05-29 15:47:35.688643	2026-05-29 17:01:02.429296	symbol:activity	#E0F2FE
abdab119-4ca8-468b-9b7f-917a3e604ceb	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	Political Science	Governance, political systems, and civic institutions.	ELS Team	\N	t	12	2026-05-29 15:47:35.689504	2026-05-29 17:01:02.430083	symbol:globe	#FFF5CC
f1ba6cfa-ec78-4d0a-87f7-a602e8e152c2	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	History	Historical events, movements, and critical interpretation of the past.	ELS Team	\N	t	12	2026-05-29 15:47:35.689234	2026-05-29 17:01:02.429812	symbol:book-open	#D6EAFF
0ddde61d-73ca-412e-9bf5-cdaabd8f61e2	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	Geography	Physical and human geography, maps, and environmental systems.	ELS Team	\N	t	12	2026-05-29 15:47:35.689775	2026-05-29 17:01:02.430325	symbol:globe	#FFF5CC
18ddda17-9c87-4585-822f-64a9bce2e5a6	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	Drawing & Coloring	Creative expression through drawing, coloring, and visual exploration.	ELS Team	\N	t	LKG	2026-05-29 15:47:35.691988	2026-05-29 17:01:02.432078	symbol:palette	#FFF5CC
58686b61-9bf4-4a7c-ba10-e9b04459d12e	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	Activity / Play-based Learning	Hands-on playful activities for social, motor, and cognitive growth.	ELS Team	\N	t	LKG	2026-05-29 15:47:35.692263	2026-05-29 17:01:02.432311	symbol:activity	#E0F2FE
8b7e5684-5fae-4112-9e0a-d2bea72c0c44	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	Biology	Life sciences including botany, zoology, and human biology.	ELS Team	\N	t	11	2026-05-29 15:47:35.684385	2026-05-29 17:01:02.424171	symbol:leaf	#D6F5D6
eb642f4b-b830-47eb-8686-dbede20dcf68	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	Psychology	Introduction to human behavior, cognition, and mental processes.	ELS Team	\N	t	12	2026-05-29 15:47:35.690032	2026-05-29 17:01:02.430559	symbol:sparkles	#EDE4FF
ba370220-2848-47ee-ad77-19bd36845024	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	English	Advanced language, literature, and communication competence.	ELS Team	\N	t	12	2026-05-29 15:47:35.690286	2026-05-29 17:01:02.430807	symbol:book-open	#D6EAFF
229b5140-e4cf-467f-a0a7-12023b146162	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	EVS	Awareness of surroundings, nature, and everyday life concepts.	ELS Team	\N	t	LKG	2026-05-21 17:32:02.250996	2026-05-29 17:01:02.43157	symbol:leaf	#D6F5D6
ba13718e-13b0-4772-981f-4e7cd695c5c9	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	English	Foundational language skills for listening, speaking, and early literacy.	ELS Team	\N	t	UKG	2026-05-29 15:47:35.69252	2026-05-29 17:01:02.43254	symbol:book-open	#D6EAFF
66d6f16c-fcfb-4a41-8849-343efb35c4cc	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	Mathematics	Number sense, counting, and early problem-solving activities.	ELS Team	\N	t	UKG	2026-05-29 15:47:35.692795	2026-05-29 17:01:02.432762	symbol:hash	#FFE8D6
71d836d7-0eba-4bc7-bd1a-7e9fb72fe493	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	Social Science	History, geography, political science, and economics basics.	ELS Team	\N	t	10	2026-05-29 15:47:35.682291	2026-05-29 17:01:02.422294	symbol:globe	#FFF5CC
c58589b0-d81f-4c8e-a899-51429f6afad4	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	Chemistry	Atomic structure, reactions, bonding, and chemical principles.	ELS Team	\N	t	11	2026-05-29 15:47:35.683842	2026-05-29 17:01:02.423548	symbol:flask	#D6F5D6
5194ebb4-8b5c-4f05-bdba-b5e4537968ae	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	Mathematics	Advanced algebra, calculus, trigonometry, and applications.	ELS Team	\N	t	11	2026-05-29 15:47:35.684133	2026-05-29 17:01:02.423852	symbol:hash	#FFE8D6
145b1aa0-be12-4fce-bfad-72f96a37e7bc	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	Computer Science	Programming, computational thinking, and computer systems.	ELS Team	\N	t	11	2026-05-29 15:47:35.68464	2026-05-29 17:01:02.424474	symbol:monitor	#E0F2FE
ce08647e-7ffd-465d-8e4e-802c5e0f42ed	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	Accountancy	Accounting principles, bookkeeping, and financial statements.	ELS Team	\N	t	11	2026-05-29 15:47:35.685027	2026-05-29 17:01:02.424774	symbol:hash	#FFE8D6
dcd3f893-6727-451b-b6f8-1c96ea582209	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	Economics	Microeconomics, macroeconomics, and market understanding.	ELS Team	\N	t	11	2026-05-29 15:47:35.685545	2026-05-29 17:01:02.425469	symbol:globe	#FFF5CC
3fe60bec-af75-4f46-bbc9-bdf1f1d94c5d	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	Political Science	Governance, political systems, and civic institutions.	ELS Team	\N	t	11	2026-05-29 15:47:35.686041	2026-05-29 17:01:02.426155	symbol:globe	#FFF5CC
3b697807-e6ca-4485-9e76-4c3347b1f286	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	Physics	Fundamentals of mechanics, waves, electricity, and modern physics.	ELS Team	\N	t	12	2026-05-29 15:47:35.687058	2026-05-29 17:01:02.427555	symbol:flask	#D6F5D6
41c9d057-a026-47f5-a8c1-4639b00f9960	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	Chemistry	Atomic structure, reactions, bonding, and chemical principles.	ELS Team	\N	t	12	2026-05-29 15:47:35.687323	2026-05-29 17:01:02.427865	symbol:flask	#D6F5D6
b4385065-6ad0-4f0c-b7fa-9506539b504a	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	Mathematics	Advanced algebra, calculus, trigonometry, and applications.	ELS Team	\N	t	12	2026-05-29 15:47:35.687591	2026-05-29 17:01:02.428283	symbol:hash	#FFE8D6
0ae18aa2-0919-4882-89bf-862a66cc6a4d	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	Activity / Play-based Learning	Hands-on playful activities for social, motor, and cognitive growth.	ELS Team	\N	t	UKG	2026-05-29 15:47:35.69386	2026-05-29 17:01:02.433747	symbol:activity	#E0F2FE
d518df68-db0d-4d0e-bdd3-818d15f037bc	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	Computer Applications / IT	Information technology and practical computer applications.	ELS Team	\N	t	9	2026-05-29 15:47:35.680867	2026-05-29 17:01:02.420961	symbol:monitor	#E0F2FE
0aca3e64-27f1-4eae-b8cf-ff5c1c327ebd	e1811769-e50e-4b03-be07-16f0057b5749	\N	Hindi	Hindi language development in reading, writing, and speaking.	ELS Team	\N	t	4	2026-05-29 15:47:35.621523	2026-05-29 17:01:02.36357	symbol:languages	#EDE4FF
62670cdf-95c2-47a2-856a-4cf861355028	e1811769-e50e-4b03-be07-16f0057b5749	\N	General Knowledge	General awareness about people, places, and the world.	ELS Team	\N	t	4	2026-05-29 15:47:35.621955	2026-05-29 17:01:02.364463	symbol:globe	#FFF5CC
d2608741-ba2d-4c21-a393-f033e87aeb80	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	Environmental Studies	Awareness of surroundings, nature, and everyday life concepts.	ELS Team	\N	t	UKG	2026-05-29 15:47:35.693062	2026-05-29 17:01:02.433015	symbol:leaf	#D6F5D6
2aaf2e3f-4a22-4be2-9a44-69f1b0a84a26	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	Rhymes & Stories	Songs, rhymes, and storytelling to build language rhythm and imagination.	ELS Team	\N	t	UKG	2026-05-29 15:47:35.69335	2026-05-29 17:01:02.433255	symbol:sparkles	#EDE4FF
dbeeedfb-98ad-48c0-b991-7ce3e5a2f63f	e1811769-e50e-4b03-be07-16f0057b5749	\N	Computer Science	Basic computer awareness, digital tools, and safe technology use.	ELS Team	\N	t	4	2026-05-29 15:47:35.622376	2026-05-29 17:01:02.365139	symbol:monitor	#E0F2FE
8e3337f1-a275-4a9a-b682-1bc6df64820d	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	Drawing & Coloring	Creative expression through drawing, coloring, and visual exploration.	ELS Team	\N	t	UKG	2026-05-29 15:47:35.693605	2026-05-29 17:01:02.433503	symbol:palette	#FFF5CC
53285e4b-2ca0-4aac-98ab-7ad46393ef9b	e1811769-e50e-4b03-be07-16f0057b5749	\N	Sanskrit	Introductory Sanskrit language and grammar foundations.	ELS Team	\N	t	6	2026-05-29 15:47:35.627831	2026-05-29 17:01:02.373498	symbol:languages	#EDE4FF
8b18e616-4d95-4f0b-941b-1fefc2622eed	e1811769-e50e-4b03-be07-16f0057b5749	\N	Business Studies	Business organization, management, and entrepreneurship basics.	ELS Team	\N	t	11	2026-05-29 15:47:35.650962	2026-05-29 17:01:02.389025	symbol:activity	#E0F2FE
a63b527a-374b-4fa6-af74-f884e990eb10	e1811769-e50e-4b03-be07-16f0057b5749	\N	Economics	Microeconomics, macroeconomics, and market understanding.	ELS Team	\N	t	11	2026-05-29 15:47:35.651439	2026-05-29 17:01:02.389357	symbol:globe	#FFF5CC
6b5af086-c32e-4ed7-9477-4454940f6192	e1811769-e50e-4b03-be07-16f0057b5749	\N	History	Historical events, movements, and critical interpretation of the past.	ELS Team	\N	t	11	2026-05-29 15:47:35.651823	2026-05-29 17:01:02.389716	symbol:book-open	#D6EAFF
8c73a3df-197f-44f9-a6de-5350b3252f97	e1811769-e50e-4b03-be07-16f0057b5749	\N	Political Science	Governance, political systems, and civic institutions.	ELS Team	\N	t	11	2026-05-29 15:47:35.652172	2026-05-29 17:01:02.390059	symbol:globe	#FFF5CC
9f0f1fbc-c9d5-4c03-b1e2-6cfdffb5600c	e1811769-e50e-4b03-be07-16f0057b5749	\N	Geography	Physical and human geography, maps, and environmental systems.	ELS Team	\N	t	11	2026-05-29 15:47:35.652534	2026-05-29 17:01:02.390399	symbol:globe	#FFF5CC
644a19d5-ae02-4e95-973b-78babd903446	e1811769-e50e-4b03-be07-16f0057b5749	\N	Psychology	Introduction to human behavior, cognition, and mental processes.	ELS Team	\N	t	11	2026-05-29 15:47:35.652889	2026-05-29 17:01:02.390718	symbol:sparkles	#EDE4FF
5e3844ea-a9af-44e4-8afc-18d0553592bb	e1811769-e50e-4b03-be07-16f0057b5749	\N	English	Advanced language, literature, and communication competence.	ELS Team	\N	t	11	2026-05-29 15:47:35.653242	2026-05-29 17:01:02.391051	symbol:book-open	#D6EAFF
a5e7258b-6bb2-4410-aa05-40b8ff7fb03e	e1811769-e50e-4b03-be07-16f0057b5749	\N	Mathematics	Number sense, counting, and early problem-solving activities.	ELS Team	\N	t	UKG	2026-05-29 15:47:35.660877	2026-05-29 17:01:02.39947	symbol:hash	#FFE8D6
acb7d540-2d41-4ef1-ae33-d42f80ae450f	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	Environmental Studies (EVS)	Integrated learning of natural and social surroundings.	ELS Team	\N	t	3	2026-05-29 15:47:35.668162	2026-05-29 17:01:02.405873	symbol:leaf	#D6F5D6
7584161b-bb1c-4d5b-880c-23630824f94c	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	Hindi	Hindi language development in reading, writing, and speaking.	ELS Team	\N	t	3	2026-05-29 15:47:35.668519	2026-05-29 17:01:02.406162	symbol:languages	#EDE4FF
77bf723c-7d76-42df-9559-e19663b8827a	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	Sanskrit	Introductory Sanskrit language and grammar foundations.	ELS Team	\N	t	6	2026-05-29 15:47:35.674913	2026-05-29 17:01:02.414064	symbol:languages	#EDE4FF
8b2934a1-0b5f-45a6-a7a2-f52c57266c92	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	Hindi	Hindi language and literature for senior middle school levels.	ELS Team	\N	t	9	2026-05-29 15:47:35.680589	2026-05-29 17:01:02.42065	symbol:languages	#EDE4FF
fb1231c5-bcf4-4cd2-937d-51a2b85ec351	e1811769-e50e-4b03-be07-16f0057b5749	\N	Political Science	Governance, political systems, and civic institutions.	ELS Team	\N	t	12	2026-05-29 15:47:35.657006	2026-05-29 17:01:02.395826	symbol:globe	#FFF5CC
3514c5d9-8186-4fc3-9ee6-8aadf092d256	e1811769-e50e-4b03-be07-16f0057b5749	\N	Social Science	History, civics, geography, and societal understanding.	ELS Team	\N	t	7	2026-05-29 15:47:35.638932	2026-05-29 17:01:02.375878	symbol:globe	#FFF5CC
c14e02e8-da21-4dd0-bf25-c6e9560f88ae	e1811769-e50e-4b03-be07-16f0057b5749	\N	Geography	Physical and human geography, maps, and environmental systems.	ELS Team	\N	t	12	2026-05-29 15:47:35.657326	2026-05-29 17:01:02.396127	symbol:globe	#FFF5CC
099ffa9d-083e-4e8f-959a-6165f1725ca7	e1811769-e50e-4b03-be07-16f0057b5749	\N	Computer Science	Basic computer awareness, digital tools, and safe technology use.	ELS Team	\N	t	5	2026-05-29 15:47:35.625197	2026-05-29 17:01:02.368964	symbol:monitor	#E0F2FE
d6851289-d323-4180-af65-fcd95b048af3	e1811769-e50e-4b03-be07-16f0057b5749	\N	Rhymes & Stories	Songs, rhymes, and storytelling to build language rhythm and imagination.	ELS Team	\N	t	LKG	2026-05-29 15:47:35.659433	2026-05-29 17:01:02.398203	symbol:sparkles	#EDE4FF
a1441d09-8cab-40d9-a703-57496264a6b1	e1811769-e50e-4b03-be07-16f0057b5749	\N	English	Reading, writing, vocabulary, and communication practice.	ELS Team	\N	t	5	2026-05-29 15:47:35.622797	2026-05-29 17:01:02.365866	symbol:book-open	#D6EAFF
492cf87b-6d42-4b36-912b-64cbed61f1d3	e1811769-e50e-4b03-be07-16f0057b5749	\N	English	Comprehension, grammar, writing skills, and communication.	ELS Team	\N	t	6	2026-05-29 15:47:35.625681	2026-05-29 17:01:02.36953	symbol:book-open	#D6EAFF
00eb36d0-d329-456e-a5d4-711a225c34f5	e1811769-e50e-4b03-be07-16f0057b5749	\N	Mathematics	Arithmetic, number operations, and logical reasoning.	ELS Team	\N	t	5	2026-05-29 15:47:35.623218	2026-05-29 17:01:02.36647	symbol:hash	#FFE8D6
db628385-e965-4816-87ed-008765e5a8e4	e1811769-e50e-4b03-be07-16f0057b5749	\N	Mathematics	Core math concepts including algebraic and numerical reasoning.	ELS Team	\N	t	6	2026-05-29 15:47:35.626104	2026-05-29 17:01:02.370137	symbol:hash	#FFE8D6
92e9f6b5-0f91-41c7-b402-cc46960de524	e1811769-e50e-4b03-be07-16f0057b5749	\N	Science	General science concepts with observation and experimentation.	ELS Team	\N	t	6	2026-05-29 15:47:35.626533	2026-05-29 17:01:02.370821	symbol:flask	#D6F5D6
69f03574-6f18-4335-bf4b-d593ab391bf9	e1811769-e50e-4b03-be07-16f0057b5749	\N	Mathematics	Core math concepts including algebraic and numerical reasoning.	ELS Team	\N	t	7	2026-05-29 15:47:35.637043	2026-05-29 17:01:02.374914	symbol:hash	#FFE8D6
e6ab0520-e69e-4c8d-8eb1-df1e3d3a4282	e1811769-e50e-4b03-be07-16f0057b5749	\N	Biology	Life sciences including botany, zoology, and human biology.	ELS Team	\N	t	12	2026-05-29 15:47:35.654675	2026-05-29 17:01:02.393496	symbol:leaf	#D6F5D6
2f43cc96-0891-4f32-8eed-b94c84814f56	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	English	Language proficiency, literature appreciation, and writing skills.	ELS Team	\N	t	10	2026-05-29 15:47:35.681161	2026-05-29 17:01:02.421311	symbol:book-open	#D6EAFF
348cd79d-5a8a-406b-bafe-bcdbc45744b5	e1811769-e50e-4b03-be07-16f0057b5749	\N	Computer Science	Programming, computational thinking, and computer systems.	ELS Team	\N	t	12	2026-05-29 15:47:35.65529	2026-05-29 17:01:02.393843	symbol:monitor	#E0F2FE
ef5419a7-3a23-4f80-a7ae-c838b3b35b7c	e1811769-e50e-4b03-be07-16f0057b5749	\N	Hindi	Hindi language and literature for senior middle school levels.	ELS Team	\N	t	9	2026-05-29 15:47:35.645825	2026-05-29 17:01:02.383378	symbol:languages	#EDE4FF
29a361e1-ada6-4793-b5eb-34bfe7d71763	e1811769-e50e-4b03-be07-16f0057b5749	\N	Science	General science concepts with observation and experimentation.	ELS Team	\N	t	7	2026-05-29 15:47:35.63772	2026-05-29 17:01:02.375381	symbol:flask	#D6F5D6
c69ac1ae-8878-465b-b80e-2eb88b36ecff	e1811769-e50e-4b03-be07-16f0057b5749	\N	Social Science	History, geography, political science, and economics basics.	ELS Team	\N	t	10	2026-05-29 15:47:35.647531	2026-05-29 17:01:02.38555	symbol:globe	#FFF5CC
653d2348-553b-4d62-8825-1fed78b261ae	e1811769-e50e-4b03-be07-16f0057b5749	\N	Physics	Fundamentals of mechanics, waves, electricity, and modern physics.	ELS Team	\N	t	12	2026-05-29 15:47:35.653627	2026-05-29 17:01:02.391394	symbol:flask	#D6F5D6
fb989606-5709-44a5-ada8-d917458ab3ae	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	History	Historical events, movements, and critical interpretation of the past.	ELS Team	\N	t	11	2026-05-29 15:47:35.685792	2026-05-29 17:01:02.425793	symbol:book-open	#D6EAFF
87fdd2b5-03cf-45c3-a91f-851583ef2ec4	e1811769-e50e-4b03-be07-16f0057b5749	\N	Accountancy	Accounting principles, bookkeeping, and financial statements.	ELS Team	\N	t	12	2026-05-29 15:47:35.655626	2026-05-29 17:01:02.394207	symbol:hash	#FFE8D6
e62bd636-33b6-41e3-9885-1e8969a26451	e1811769-e50e-4b03-be07-16f0057b5749	\N	Business Studies	Business organization, management, and entrepreneurship basics.	ELS Team	\N	t	12	2026-05-29 15:47:35.655972	2026-05-29 17:01:02.394612	symbol:activity	#E0F2FE
75a7b5f3-4398-40a5-b4f1-af7e0497dcf1	e1811769-e50e-4b03-be07-16f0057b5749	\N	Chemistry	Atomic structure, reactions, bonding, and chemical principles.	ELS Team	\N	t	12	2026-05-29 15:47:35.653987	2026-05-29 17:01:02.39259	symbol:flask	#D6F5D6
af592af8-615a-48f4-80e5-f5ce3264b997	e1811769-e50e-4b03-be07-16f0057b5749	\N	Economics	Microeconomics, macroeconomics, and market understanding.	ELS Team	\N	t	12	2026-05-29 15:47:35.65632	2026-05-29 17:01:02.395068	symbol:globe	#FFF5CC
9512430f-1700-41c7-ba4a-a395f8ae4f6e	e1811769-e50e-4b03-be07-16f0057b5749	\N	English	Foundational language skills for listening, speaking, and early literacy.	ELS Team	\N	t	LKG	2026-05-29 15:47:35.658351	2026-05-29 17:01:02.397226	symbol:book-open	#D6EAFF
9f2afc89-692b-4191-a90a-a6e136490bbb	e1811769-e50e-4b03-be07-16f0057b5749	\N	History	Historical events, movements, and critical interpretation of the past.	ELS Team	\N	t	12	2026-05-29 15:47:35.656663	2026-05-29 17:01:02.395421	symbol:book-open	#D6EAFF
b9c14b45-8fee-49b6-a929-876081430a26	e1811769-e50e-4b03-be07-16f0057b5749	\N	Mathematics	Number sense, counting, and early problem-solving activities.	ELS Team	\N	t	LKG	2026-05-29 15:47:35.658709	2026-05-29 17:01:02.39756	symbol:hash	#FFE8D6
9d8b648e-0150-4296-9ab9-6aa19ff02516	e1811769-e50e-4b03-be07-16f0057b5749	\N	Environmental Studies	Awareness of surroundings, nature, and everyday life concepts.	ELS Team	\N	t	LKG	2026-05-29 15:47:35.659062	2026-05-29 17:01:02.397879	symbol:leaf	#D6F5D6
45f754d2-76da-4e18-b4de-f40145848edd	e1811769-e50e-4b03-be07-16f0057b5749	\N	Environmental Studies (EVS)	Integrated learning of natural and social surroundings.	ELS Team	\N	t	5	2026-05-29 15:47:35.623681	2026-05-29 17:01:02.367162	symbol:leaf	#D6F5D6
257761c0-5255-4adf-84da-e3476fd88666	e1811769-e50e-4b03-be07-16f0057b5749	\N	Hindi	Hindi language development in reading, writing, and speaking.	ELS Team	\N	t	5	2026-05-29 15:47:35.624117	2026-05-29 17:01:02.367729	symbol:languages	#EDE4FF
2c0392cc-0263-41a8-9dd0-7d4c35960f8e	e1811769-e50e-4b03-be07-16f0057b5749	\N	Mathematics	Advanced algebra, calculus, trigonometry, and applications.	ELS Team	\N	t	12	2026-05-29 15:47:35.654329	2026-05-29 17:01:02.39292	symbol:hash	#FFE8D6
20677f1d-4251-448e-86f9-134502f5b1d7	e1811769-e50e-4b03-be07-16f0057b5749	\N	General Knowledge	General awareness about people, places, and the world.	ELS Team	\N	t	5	2026-05-29 15:47:35.624578	2026-05-29 17:01:02.368359	symbol:globe	#FFF5CC
7b054446-c922-4f2c-ad50-3fd763b486b4	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	Mathematics	Algebra, geometry, mensuration, and problem-solving.	ELS Team	\N	t	10	2026-05-29 15:47:35.681427	2026-05-29 17:01:02.421637	symbol:hash	#FFE8D6
3140a8d0-f593-4fc8-aa52-848b029387be	e1811769-e50e-4b03-be07-16f0057b5749	\N	Drawing & Coloring	Creative expression through drawing, coloring, and visual exploration.	ELS Team	\N	t	LKG	2026-05-29 15:47:35.659811	2026-05-29 17:01:02.398516	symbol:palette	#FFF5CC
17538b48-d4a3-4032-b4a9-4d2d019e39d8	e1811769-e50e-4b03-be07-16f0057b5749	\N	Activity / Play-based Learning	Hands-on playful activities for social, motor, and cognitive growth.	ELS Team	\N	t	LKG	2026-05-29 15:47:35.660189	2026-05-29 17:01:02.398857	symbol:activity	#E0F2FE
6ec98106-f481-410d-a4b2-b29d60cbd006	e1811769-e50e-4b03-be07-16f0057b5749	\N	English	Foundational language skills for listening, speaking, and early literacy.	ELS Team	\N	t	UKG	2026-05-29 15:47:35.660533	2026-05-29 17:01:02.399154	symbol:book-open	#D6EAFF
502f3519-2c4e-4cc0-b495-0502387beba2	e1811769-e50e-4b03-be07-16f0057b5749	\N	Rhymes & Stories	Songs, rhymes, and storytelling to build language rhythm and imagination.	ELS Team	\N	t	UKG	2026-05-29 15:47:35.661573	2026-05-29 17:01:02.400073	symbol:sparkles	#EDE4FF
4e5d1067-fa9f-4a4d-a0d1-d1afb2e23b81	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	Economics	Microeconomics, macroeconomics, and market understanding.	ELS Team	\N	t	12	2026-05-29 15:47:35.688948	2026-05-29 17:01:02.429551	symbol:globe	#FFF5CC
3fb4d64e-7a79-43f2-91b0-2e74e8639194	e1811769-e50e-4b03-be07-16f0057b5749	\N	Drawing & Coloring	Creative expression through drawing, coloring, and visual exploration.	ELS Team	\N	t	UKG	2026-05-29 15:47:35.661915	2026-05-29 17:01:02.400374	symbol:palette	#FFF5CC
e2166bad-5ee9-4ebc-82ec-9982241014f7	e1811769-e50e-4b03-be07-16f0057b5749	\N	Activity / Play-based Learning	Hands-on playful activities for social, motor, and cognitive growth.	ELS Team	\N	t	UKG	2026-05-29 15:47:35.662267	2026-05-29 17:01:02.400996	symbol:activity	#E0F2FE
efa0f5a7-735c-42cd-ba67-cc70ffedb4fc	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	English	Reading, writing, vocabulary, and communication practice.	ELS Team	\N	t	1	2026-05-21 17:32:02.250996	2026-05-29 17:01:02.401347	symbol:book-open	#D6EAFF
3afa10fd-084f-4301-bb74-90b189e3128e	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	Mathematics	Arithmetic, number operations, and logical reasoning.	ELS Team	\N	t	1	2026-05-29 15:47:35.663086	2026-05-29 17:01:02.401661	symbol:hash	#FFE8D6
fd9ca7a2-7959-44fe-817e-930e511dcb1a	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	Environmental Studies (EVS)	Integrated learning of natural and social surroundings.	ELS Team	\N	t	1	2026-05-29 15:47:35.663486	2026-05-29 17:01:02.401976	symbol:leaf	#D6F5D6
ede4bcbb-fd80-405e-b9cf-642da4f93dd9	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	General Knowledge	General awareness about people, places, and the world.	ELS Team	\N	t	3	2026-05-29 15:47:35.668846	2026-05-29 17:01:02.406463	symbol:globe	#FFF5CC
a522f0b8-d2cf-4e65-97d2-ee84f3bd6bf0	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	Environmental Studies (EVS)	Integrated learning of natural and social surroundings.	ELS Team	\N	t	5	2026-05-29 15:47:35.672129	2026-05-29 17:01:02.409554	symbol:leaf	#D6F5D6
961f54f5-2538-46f0-8b28-a288f8190b6a	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	Mathematics	Core math concepts including algebraic and numerical reasoning.	ELS Team	\N	t	7	2026-05-29 15:47:35.675763	2026-05-29 17:01:02.415004	symbol:hash	#FFE8D6
1a35d098-8b8f-417b-9c6b-87a1d57b9e3c	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	Science	General science concepts with observation and experimentation.	ELS Team	\N	t	7	2026-05-29 15:47:35.676034	2026-05-29 17:01:02.415328	symbol:flask	#D6F5D6
f42949b4-f3e8-41fc-b529-def19a863096	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	Social Science	History, civics, geography, and societal understanding.	ELS Team	\N	t	7	2026-05-29 15:47:35.676449	2026-05-29 17:01:02.415657	symbol:globe	#FFF5CC
7875fb6e-c722-417c-9810-cc305c2e006c	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	Hindi	Advanced Hindi language and literature fundamentals.	ELS Team	\N	t	7	2026-05-29 15:47:35.676711	2026-05-29 17:01:02.415997	symbol:languages	#EDE4FF
5b514a61-6e4e-442d-bd76-a416be3fa125	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	Sanskrit	Introductory Sanskrit language and grammar foundations.	ELS Team	\N	t	7	2026-05-29 15:47:35.676963	2026-05-29 17:01:02.416345	symbol:languages	#EDE4FF
f6be1744-c4ee-4c62-b07c-3a78b4b7a1f1	e1811769-e50e-4b03-be07-16f0057b5749	\N	English	Advanced language, literature, and communication competence.	ELS Team	\N	t	12	2026-05-29 15:47:35.657991	2026-05-29 17:01:02.396832	symbol:book-open	#D6EAFF
c5bb89fd-9217-4257-ad0f-7022694169f7	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	Hindi	Hindi language development in reading, writing, and speaking.	ELS Team	\N	t	5	2026-05-29 15:47:35.672454	2026-05-29 17:01:02.409861	symbol:languages	#EDE4FF
a356f499-002f-4fc6-a928-cb9d111d1bb0	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	General Knowledge	General awareness about people, places, and the world.	ELS Team	\N	t	5	2026-05-29 15:47:35.672777	2026-05-29 17:01:02.410164	symbol:globe	#FFF5CC
c4745c2f-973e-4416-a62c-6420b2fbbb09	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	Computer Science	Basic computer awareness, digital tools, and safe technology use.	ELS Team	\N	t	5	2026-05-29 15:47:35.673078	2026-05-29 17:01:02.412141	symbol:monitor	#E0F2FE
1b549128-8990-42a0-8b7b-603c8d69fd7d	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	English	Comprehension, grammar, writing skills, and communication.	ELS Team	\N	t	6	2026-05-29 15:47:35.673385	2026-05-29 17:01:02.412503	symbol:book-open	#D6EAFF
2ff4b32a-7723-422d-a24f-e55df5e608ec	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	Science (Physics, Chemistry, Biology)	Integrated science with conceptual and practical understanding.	ELS Team	\N	t	10	2026-05-29 15:47:35.681938	2026-05-29 17:01:02.421974	symbol:flask	#D6F5D6
9a2af4cd-b644-4616-bbd5-80d1cad4d08b	8ba8388f-9907-486c-9883-3784c2f2f34e	\N	Business Studies	Business organization, management, and entrepreneurship basics.	ELS Team	\N	t	11	2026-05-29 15:47:35.685283	2026-05-29 17:01:02.425147	symbol:activity	#E0F2FE
e5ecf140-265b-46c9-9026-31ff2aef1af1	e1811769-e50e-4b03-be07-16f0057b5749	\N	Computer Science	Digital literacy, basic coding ideas, and computer applications.	ELS Team	\N	t	8	2026-05-29 15:47:35.643771	2026-05-29 17:01:02.381433	symbol:monitor	#E0F2FE
ea7d2248-db95-493b-bea7-8f05ff5f4b9d	e1811769-e50e-4b03-be07-16f0057b5749	\N	English	Language proficiency, literature appreciation, and writing skills.	ELS Team	\N	t	9	2026-05-29 15:47:35.644276	2026-05-29 17:01:02.381819	symbol:book-open	#D6EAFF
674ea9df-caf8-4aca-b6de-57161b09186a	e1811769-e50e-4b03-be07-16f0057b5749	\N	Mathematics	Algebra, geometry, mensuration, and problem-solving.	ELS Team	\N	t	9	2026-05-29 15:47:35.644698	2026-05-29 17:01:02.382185	symbol:hash	#FFE8D6
d78460f1-4795-4373-830d-b1ee9b518942	e1811769-e50e-4b03-be07-16f0057b5749	\N	Science (Physics, Chemistry, Biology)	Integrated science with conceptual and practical understanding.	ELS Team	\N	t	9	2026-05-29 15:47:35.645112	2026-05-29 17:01:02.382552	symbol:flask	#D6F5D6
4eda3553-8074-4d20-925d-b547414b5f10	e1811769-e50e-4b03-be07-16f0057b5749	\N	Social Science	History, geography, political science, and economics basics.	ELS Team	\N	t	9	2026-05-29 15:47:35.645485	2026-05-29 17:01:02.382905	symbol:globe	#FFF5CC
837c4ff6-2b5e-41eb-981e-5b00aa595668	e1811769-e50e-4b03-be07-16f0057b5749	\N	Psychology	Introduction to human behavior, cognition, and mental processes.	ELS Team	\N	t	12	2026-05-29 15:47:35.657651	2026-05-29 17:01:02.396442	symbol:sparkles	#EDE4FF
\.


--
-- Data for Name: subscription_plans; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.subscription_plans (id, name, description, membership_tier, billing_cycle, base_price, offer_discount_percent, special_discount_percent, group_discount_percent, max_users_for_group_discount, is_active, created_at, updated_at) FROM stdin;
2459c2ec-8136-4538-80d9-23aaee719e78	Gold Pro	Advanced features and premium support	gold	monthly	3999.00	12.00	8.00	8.00	30	t	2026-05-27 15:11:58.385293	2026-05-27 15:11:58.385293
fe06a1bd-f4ff-47ed-bf9d-3e2bb7dcaf01	Platinum Enterprise	Enterprise-grade feature set	platinum	yearly	39999.00	15.00	10.00	12.00	50	t	2026-05-27 15:11:58.385293	2026-05-27 15:11:58.385293
65c9ac73-e917-42d9-9d5e-3de5ba93d431	Silver Growth	Growth plan for active organizations	silver	monthly	1999.00	0.00	0.00	0.00	10	t	2026-05-27 15:11:58.385293	2026-05-27 21:24:45.47022
78366682-47b1-4d4a-8865-c2cb6f801cf0	Bronze Starter	Starter access for schools	bronze	monthly	999.00	0.00	0.00	0.00	10	t	2026-05-27 15:11:58.385293	2026-05-27 21:25:06.000368
\.


--
-- Data for Name: teacher_standard_subjects; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.teacher_standard_subjects (id, teacher_user_id, organization_id, class_level, subject, created_at) FROM stdin;
04fca13e-02e9-443b-8ef5-34bdbcd9a928	866bc022-307f-4218-94a3-7622dd2aec79	8ba8388f-9907-486c-9883-3784c2f2f34e	3	Hindi Stories	2026-05-22 13:43:40.242759
e2421953-7737-4b85-a80f-721689ccd811	866bc022-307f-4218-94a3-7622dd2aec79	8ba8388f-9907-486c-9883-3784c2f2f34e	2	Mathematics	2026-05-22 13:43:40.242759
80e8b60a-8d59-4534-a39f-ec95cc265b00	866bc022-307f-4218-94a3-7622dd2aec79	8ba8388f-9907-486c-9883-3784c2f2f34e	1	English	2026-05-22 13:43:40.242759
\.


--
-- Data for Name: topic_content_assignments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.topic_content_assignments (id, topic_id, content_id, sort_order, created_at) FROM stdin;
bf49ea88-44b7-4b82-b183-c70e8803abb4	b9bddfce-76dc-4128-a8ce-ee29092f0dc6	b9947905-fc92-41ab-b571-d89a3dd659a3	1	2026-05-21 17:32:02.261466
28771ea1-e734-44f9-b6b7-aced177d3673	3f958c31-4f27-4e40-8d55-99233727e105	f316f4c9-8b8f-4cc7-a99f-b593fa1fb02c	1	2026-05-21 17:32:02.262409
6b3d14db-0d25-407d-88fc-515814008b90	81a7d72e-9f53-4807-a263-c59450883298	040dc8a2-5469-4346-b196-60869396865b	1	2026-05-22 13:56:44.431485
057296c2-1b4f-4823-92d0-05e753f86a80	81a7d72e-9f53-4807-a263-c59450883298	853aa843-81a1-4b3f-b6e6-4b63647d805a	2	2026-05-22 13:56:44.431485
efe69c33-d5f0-4eba-a337-bdf03af532ac	81a7d72e-9f53-4807-a263-c59450883298	649a210b-0d22-4443-b88a-f67af0d0e6a9	3	2026-05-22 13:56:44.431485
1debd364-c129-43b4-9f31-73ed365a0f84	81a7d72e-9f53-4807-a263-c59450883298	85bb8d1f-b2d3-4e99-b413-ef234271815d	4	2026-05-22 13:56:44.431485
b607da7e-bca9-4732-933f-df7f3422efc9	81a7d72e-9f53-4807-a263-c59450883298	3240ae39-f4c9-47a1-bcc1-f42abfe35f4b	5	2026-05-22 13:56:44.431485
411a294a-e18b-456a-92b9-e13708ec90c8	81a7d72e-9f53-4807-a263-c59450883298	e35b7086-c0d9-43bc-a61b-5d96f10930f6	6	2026-05-22 13:56:44.431485
c3caf1c3-a628-4d84-af43-8b17e7bd789f	81a7d72e-9f53-4807-a263-c59450883298	1974f419-c86e-4cfe-8a18-60f6b504390d	7	2026-05-22 13:56:44.431485
1ea90b4d-ce13-411b-b768-f83843d7d5de	81a7d72e-9f53-4807-a263-c59450883298	2fb51f06-96e1-4646-96a0-75d0df187c83	8	2026-05-22 13:56:44.431485
51af419c-97b3-42ad-a37b-50c9a9c791ab	81a7d72e-9f53-4807-a263-c59450883298	3295472b-08a3-4b2f-a5a9-116e3dd929a0	9	2026-05-22 13:56:44.431485
2b4cace3-7e97-4e0f-8026-dd5f4a4442a3	81a7d72e-9f53-4807-a263-c59450883298	3c7e9162-e94e-488f-96a4-cf59b3453cc8	10	2026-05-22 13:56:44.431485
54ab9243-e6c9-4597-9940-d349e7f43990	c78ac65b-1a7e-47ed-8f8c-edf26ee40108	040dc8a2-5469-4346-b196-60869396865b	1	2026-05-22 15:41:02.701957
d9facdc3-c296-458a-a878-99c61d4186f6	c78ac65b-1a7e-47ed-8f8c-edf26ee40108	1974f419-c86e-4cfe-8a18-60f6b504390d	2	2026-05-22 15:41:02.701957
94aed4e7-4fe4-4df7-84ff-4cf89d1e361a	c78ac65b-1a7e-47ed-8f8c-edf26ee40108	3295472b-08a3-4b2f-a5a9-116e3dd929a0	3	2026-05-22 15:41:02.701957
be4133e1-6ab8-4794-bf3b-72cf8589c796	c78ac65b-1a7e-47ed-8f8c-edf26ee40108	dd18c8fc-ca59-45e9-a02d-4cd78023f928	4	2026-05-22 15:41:02.701957
3d103d8e-5604-4a7e-adb8-9b734d1e5358	abab4c93-6170-4b8b-b870-53b2204b6d21	9b7d9a5d-b665-48f7-8924-7f4b5478eaa9	0	2026-05-29 18:37:10.49004
90143f5e-e624-4289-a275-2765a7bb370c	6c95753e-72f8-4991-9140-9a191dfd3b09	0f25e529-1cb5-49f5-9671-8463f08de3c2	0	2026-05-29 18:37:11.730132
30021c0b-5e42-485b-a64a-2fda2ac0de87	8ad4c947-6907-4faf-8979-2b5d383be925	bebf531e-d4ae-471f-9b81-d25ecdca02ac	0	2026-05-29 18:37:12.963206
a77c6f83-99ae-4964-9046-99fb17197f94	22bee16a-51d9-4b57-927d-9362be9069ca	1dd3f060-2a1f-4b5a-b766-917dffc898bd	0	2026-05-29 18:37:14.196854
552b6dbf-37da-4f8a-9b4b-37951af86301	537a4350-ec04-4f2d-8008-57c438b15c78	7c44d2b3-fc5b-4c56-8c3a-3879b2e5e52e	0	2026-05-29 18:37:15.437803
cc4ea304-7fc5-4c3d-b3cc-215086adf547	05e302de-34ec-4fc3-974f-7870f17100a2	40e619d7-16e6-4e4b-b317-7bb22b86dc61	0	2026-05-29 18:37:16.668494
e4ab8bfc-c04e-41a6-9662-60deef94f471	967b05c6-1a77-4af2-9d59-a9173ccd9841	ae68c5a0-5714-45bf-b4e3-951af9c6af7d	0	2026-05-29 18:37:17.902544
3a579217-d301-485e-84ab-d543651d1dc5	b0d5556f-c326-4509-a78e-cf5b7f646119	06ecf78f-2563-4e8e-816a-8f42188f18ef	0	2026-05-29 18:37:19.141599
017c5db0-2320-4061-844a-ef4b9f59ceb2	271dd99c-8da0-4b42-ba47-9ff8edcffab3	9977430e-9123-4751-8327-024d456e896a	0	2026-05-29 18:37:20.372749
13eb8e25-3282-4a42-85c6-f0a6d6e83fdb	cad6a327-c1b2-4dce-a6d8-196fd25ede80	ebd5a137-e809-4c2a-bf2f-ae06f7862eea	0	2026-05-29 18:37:21.604321
\.


--
-- Data for Name: topic_content_sections; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.topic_content_sections (id, topic_id, section_order, content_type, media_url, external_url, text_content, created_at, updated_at, title) FROM stdin;
8308d322-d286-440e-bc6d-fa234191f5da	abab4c93-6170-4b8b-b870-53b2204b6d21	1	text	\N	\N	Simple Mathematics concepts for LKG: Numbers and Counting with visuals, actions, and repetition.	2026-05-29 18:35:37.964165	2026-05-29 18:35:37.964165	Summary
f7f71530-0f4c-4756-b52e-c83148b3d25e	abab4c93-6170-4b8b-b870-53b2204b6d21	2	youtube_url	\N	https://www.youtube.com/watch?v=DR-cfDsHCGA	\N	2026-05-29 18:35:37.964165	2026-05-29 18:35:37.964165	Watch & Learn 1
252293c1-c541-4473-8ec3-59c953cb8ad6	abab4c93-6170-4b8b-b870-53b2204b6d21	3	youtube_url	\N	https://www.youtube.com/watch?v=HrxZWNu72WI	\N	2026-05-29 18:35:37.964165	2026-05-29 18:35:37.964165	Watch & Learn 2
955c2dbf-b5fc-47f0-8dae-25231bb30de9	abab4c93-6170-4b8b-b870-53b2204b6d21	4	text	\N	\N	Show picture cards, ask children to answer by tapping, matching, and speaking.	2026-05-29 18:35:37.964165	2026-05-29 18:35:37.964165	Classroom Activity
80f6d3b3-5f57-43a5-ba56-2e76df3c7e1b	6c95753e-72f8-4991-9140-9a191dfd3b09	1	text	\N	\N	Simple Mathematics concepts for LKG: Shapes and Comparison with visuals, actions, and repetition.	2026-05-29 18:35:37.990145	2026-05-29 18:35:37.990145	Summary
05860b94-8325-473a-ad68-e937a3a7776f	6c95753e-72f8-4991-9140-9a191dfd3b09	2	youtube_url	\N	https://www.youtube.com/watch?v=HrxZWNu72WI	\N	2026-05-29 18:35:37.990145	2026-05-29 18:35:37.990145	Watch & Learn 1
88318dd8-7349-4173-9fc7-a09471988900	6c95753e-72f8-4991-9140-9a191dfd3b09	3	youtube_url	\N	https://www.youtube.com/watch?v=DR-cfDsHCGA	\N	2026-05-29 18:35:37.990145	2026-05-29 18:35:37.990145	Watch & Learn 2
1b0f4aec-682e-4146-85c5-c4063cadeabd	6c95753e-72f8-4991-9140-9a191dfd3b09	4	text	\N	\N	Show picture cards, ask children to answer by tapping, matching, and speaking.	2026-05-29 18:35:37.990145	2026-05-29 18:35:37.990145	Classroom Activity
2eb98333-dd78-4c22-ba80-e2fee03bb01a	8ad4c947-6907-4faf-8979-2b5d383be925	1	text	\N	\N	Simple English concepts for LKG: Alphabet and Phonics with visuals, actions, and repetition.	2026-05-29 18:35:38.005401	2026-05-29 18:35:38.005401	Summary
3bad8cfb-9dd5-4226-97d2-f7bb8852d003	8ad4c947-6907-4faf-8979-2b5d383be925	2	youtube_url	\N	https://www.youtube.com/watch?v=75p-N9YKqNo	\N	2026-05-29 18:35:38.005401	2026-05-29 18:35:38.005401	Watch & Learn 1
afb82bc1-1268-4d22-8e09-1fcb230a1874	8ad4c947-6907-4faf-8979-2b5d383be925	3	youtube_url	\N	https://www.youtube.com/watch?v=BELlZKpi1Zs	\N	2026-05-29 18:35:38.005401	2026-05-29 18:35:38.005401	Watch & Learn 2
b6364c17-c440-4aac-a6e2-7af69f5f588d	8ad4c947-6907-4faf-8979-2b5d383be925	4	text	\N	\N	Show picture cards, ask children to answer by tapping, matching, and speaking.	2026-05-29 18:35:38.005401	2026-05-29 18:35:38.005401	Classroom Activity
73f34178-a826-4f7c-99e6-7600ce76a98c	22bee16a-51d9-4b57-927d-9362be9069ca	1	text	\N	\N	Simple English concepts for LKG: Simple Words with visuals, actions, and repetition.	2026-05-29 18:35:38.020021	2026-05-29 18:35:38.020021	Summary
d2b6c868-cb26-4439-ba3c-7fcc3201e43e	22bee16a-51d9-4b57-927d-9362be9069ca	2	youtube_url	\N	https://www.youtube.com/watch?v=BELlZKpi1Zs	\N	2026-05-29 18:35:38.020021	2026-05-29 18:35:38.020021	Watch & Learn 1
535914e9-f578-4e4d-9500-a87f2ea93c60	22bee16a-51d9-4b57-927d-9362be9069ca	3	youtube_url	\N	https://www.youtube.com/watch?v=75p-N9YKqNo	\N	2026-05-29 18:35:38.020021	2026-05-29 18:35:38.020021	Watch & Learn 2
f2d849d3-e339-4116-89cf-c4f1cfd67c3f	22bee16a-51d9-4b57-927d-9362be9069ca	4	text	\N	\N	Show picture cards, ask children to answer by tapping, matching, and speaking.	2026-05-29 18:35:38.020021	2026-05-29 18:35:38.020021	Classroom Activity
09d35830-44eb-4d9c-b723-cbebaca130c9	537a4350-ec04-4f2d-8008-57c438b15c78	1	text	\N	\N	Simple EVS concepts for LKG: Animals and Homes with visuals, actions, and repetition.	2026-05-29 18:35:38.034945	2026-05-29 18:35:38.034945	Summary
b9e98d5d-a313-4a6f-af0a-f13139454c93	537a4350-ec04-4f2d-8008-57c438b15c78	2	youtube_url	\N	https://www.youtube.com/results?search_query=lkg+evs+animals+and+their+homes	\N	2026-05-29 18:35:38.034945	2026-05-29 18:35:38.034945	Watch & Learn 1
f2f3ee01-917c-42ed-9ab7-5ca739336034	537a4350-ec04-4f2d-8008-57c438b15c78	3	youtube_url	\N	https://www.youtube.com/results?search_query=lkg+pet+animals+for+kids	\N	2026-05-29 18:35:38.034945	2026-05-29 18:35:38.034945	Watch & Learn 2
82a24b4b-e9f9-4a4c-bbd5-0927be7b3c43	537a4350-ec04-4f2d-8008-57c438b15c78	4	text	\N	\N	Show picture cards, ask children to answer by tapping, matching, and speaking.	2026-05-29 18:35:38.034945	2026-05-29 18:35:38.034945	Classroom Activity
157a32d9-2d26-42d9-a95b-a69fae8982fd	05e302de-34ec-4fc3-974f-7870f17100a2	1	text	\N	\N	Simple EVS concepts for LKG: Plants and Helpers with visuals, actions, and repetition.	2026-05-29 18:35:38.0491	2026-05-29 18:35:38.0491	Summary
50dde0ad-6aab-4d47-be79-f09adbe43e66	05e302de-34ec-4fc3-974f-7870f17100a2	2	youtube_url	\N	https://www.youtube.com/results?search_query=lkg+plants+for+kids+english	\N	2026-05-29 18:35:38.0491	2026-05-29 18:35:38.0491	Watch & Learn 1
26adbddb-2b74-42db-8aaf-541f2d4f81ba	05e302de-34ec-4fc3-974f-7870f17100a2	3	youtube_url	\N	https://www.youtube.com/results?search_query=lkg+community+helpers+for+kids	\N	2026-05-29 18:35:38.0491	2026-05-29 18:35:38.0491	Watch & Learn 2
c3f30870-75c2-4389-9864-36449d2b6ed9	05e302de-34ec-4fc3-974f-7870f17100a2	4	text	\N	\N	Show picture cards, ask children to answer by tapping, matching, and speaking.	2026-05-29 18:35:38.0491	2026-05-29 18:35:38.0491	Classroom Activity
fc3beb53-c328-4d4d-bc42-25260d7ac05c	967b05c6-1a77-4af2-9d59-a9173ccd9841	1	text	\N	\N	Simple General Knowledge concepts for LKG: Colours and Objects with visuals, actions, and repetition.	2026-05-29 18:35:38.060622	2026-05-29 18:35:38.060622	Summary
b62a9c95-01cd-4f65-9779-d6614369b52f	967b05c6-1a77-4af2-9d59-a9173ccd9841	2	youtube_url	\N	https://www.youtube.com/watch?v=zxIpA5nF_LY	\N	2026-05-29 18:35:38.060622	2026-05-29 18:35:38.060622	Watch & Learn 1
535080a2-f16f-44aa-8fae-a913b51cbd33	967b05c6-1a77-4af2-9d59-a9173ccd9841	3	youtube_url	\N	https://www.youtube.com/results?search_query=lkg+colours+for+kids+english	\N	2026-05-29 18:35:38.060622	2026-05-29 18:35:38.060622	Watch & Learn 2
94cf1a6e-f16e-411c-8b3c-5acbe91ba727	967b05c6-1a77-4af2-9d59-a9173ccd9841	4	text	\N	\N	Show picture cards, ask children to answer by tapping, matching, and speaking.	2026-05-29 18:35:38.060622	2026-05-29 18:35:38.060622	Classroom Activity
b2682d95-137b-4f6b-875a-21c2741f499d	b0d5556f-c326-4509-a78e-cf5b7f646119	1	text	\N	\N	Simple General Knowledge concepts for LKG: Transport and Festivals with visuals, actions, and repetition.	2026-05-29 18:35:38.072269	2026-05-29 18:35:38.072269	Summary
77e11428-b1a0-41a6-a5fd-030dae2d9112	b0d5556f-c326-4509-a78e-cf5b7f646119	2	youtube_url	\N	https://www.youtube.com/watch?v=zxIpA5nF_LY	\N	2026-05-29 18:35:38.072269	2026-05-29 18:35:38.072269	Watch & Learn 1
a8bf8172-69d1-4815-8668-e90e0179c40d	b0d5556f-c326-4509-a78e-cf5b7f646119	3	youtube_url	\N	https://www.youtube.com/results?search_query=lkg+transport+name+for+kids	\N	2026-05-29 18:35:38.072269	2026-05-29 18:35:38.072269	Watch & Learn 2
065248bd-b0f5-47c5-9676-5601da3936f3	b0d5556f-c326-4509-a78e-cf5b7f646119	4	text	\N	\N	Show picture cards, ask children to answer by tapping, matching, and speaking.	2026-05-29 18:35:38.072269	2026-05-29 18:35:38.072269	Classroom Activity
4291836e-fd46-40c5-bd98-d70a77f8b54e	271dd99c-8da0-4b42-ba47-9ff8edcffab3	1	text	\N	\N	Simple Moral Values concepts for LKG: Sharing and Caring with visuals, actions, and repetition.	2026-05-29 18:35:38.085822	2026-05-29 18:35:38.085822	Summary
5e8bbc6e-9b13-4977-a3f6-326d6257021b	271dd99c-8da0-4b42-ba47-9ff8edcffab3	2	youtube_url	\N	https://www.youtube.com/results?search_query=sharing+is+caring+story+for+kids+english	\N	2026-05-29 18:35:38.085822	2026-05-29 18:35:38.085822	Watch & Learn 1
1edd82b1-1480-46ed-8e02-11ac4dae0923	271dd99c-8da0-4b42-ba47-9ff8edcffab3	3	youtube_url	\N	https://www.youtube.com/results?search_query=kindness+story+for+kids+english	\N	2026-05-29 18:35:38.085822	2026-05-29 18:35:38.085822	Watch & Learn 2
944df318-64e8-412c-8b27-c27c49601f4f	271dd99c-8da0-4b42-ba47-9ff8edcffab3	4	text	\N	\N	Show picture cards, ask children to answer by tapping, matching, and speaking.	2026-05-29 18:35:38.085822	2026-05-29 18:35:38.085822	Classroom Activity
dafe7f4d-43d8-4314-a5dd-a48328d25333	cad6a327-c1b2-4dce-a6d8-196fd25ede80	1	text	\N	\N	Simple Moral Values concepts for LKG: Honesty and Respect with visuals, actions, and repetition.	2026-05-29 18:35:38.096867	2026-05-29 18:35:38.096867	Summary
488f9fb2-2470-42f5-a8f0-08700e312330	cad6a327-c1b2-4dce-a6d8-196fd25ede80	2	youtube_url	\N	https://www.youtube.com/results?search_query=honesty+story+for+kids+short+animated	\N	2026-05-29 18:35:38.096867	2026-05-29 18:35:38.096867	Watch & Learn 1
b63bfb74-af4e-460b-b614-19abc3206e0c	cad6a327-c1b2-4dce-a6d8-196fd25ede80	3	youtube_url	\N	https://www.youtube.com/results?search_query=respect+for+elders+for+kids	\N	2026-05-29 18:35:38.096867	2026-05-29 18:35:38.096867	Watch & Learn 2
2fb7083c-062c-4b35-9add-75b759eb50bc	cad6a327-c1b2-4dce-a6d8-196fd25ede80	4	text	\N	\N	Show picture cards, ask children to answer by tapping, matching, and speaking.	2026-05-29 18:35:38.096867	2026-05-29 18:35:38.096867	Classroom Activity
\.


--
-- Data for Name: user_global_publish_permissions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_global_publish_permissions (id, user_id, organization_id, enabled, granted_by, granted_at, updated_at) FROM stdin;
c61d1eae-19d7-4084-a50e-c891eb6d6b7d	50945a5f-b020-461a-8c47-63e74087c228	8ba8388f-9907-486c-9883-3784c2f2f34e	f	866bc022-307f-4218-94a3-7622dd2aec79	2026-05-27 21:24:25.55265	2026-05-27 21:24:33.149771
\.


--
-- Data for Name: user_org_mapping; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_org_mapping (id, user_id, organization_id, is_primary, joined_at) FROM stdin;
5a7fd5f9-6315-492f-97ef-8d679a2b34f0	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	8ba8388f-9907-486c-9883-3784c2f2f34e	t	2026-05-27 19:58:54.005231
964ef251-3eb1-49d1-8f6f-7baae6a38d59	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	8ba8388f-9907-486c-9883-3784c2f2f34e	t	2026-05-27 19:58:54.005231
082aad3b-916c-4592-928d-624cc20c4c93	50945a5f-b020-461a-8c47-63e74087c228	8ba8388f-9907-486c-9883-3784c2f2f34e	t	2026-05-27 19:58:54.005231
a111f45f-33d6-4cc5-bdde-a439897afbc2	6e38cbca-9dc0-4b75-98f8-6ebbe508c90d	8ba8388f-9907-486c-9883-3784c2f2f34e	t	2026-05-27 19:58:54.005231
8dcdcccc-ed42-4569-a720-435311ca5b5b	70d9527d-011a-4548-ab1b-77a9c050e2dd	8ba8388f-9907-486c-9883-3784c2f2f34e	t	2026-05-27 19:58:54.005231
ace1dd65-d608-44c1-93c8-70bed83bbf79	866bc022-307f-4218-94a3-7622dd2aec79	8ba8388f-9907-486c-9883-3784c2f2f34e	t	2026-05-27 19:58:54.005231
9dd5d7e8-2f7f-49a0-b011-179d56381bea	c2fd6bc5-5766-4eba-b691-0438f77e3d33	8ba8388f-9907-486c-9883-3784c2f2f34e	t	2026-05-27 19:58:54.005231
fd46cbef-df8e-4d6e-a4c4-c7cb1f9f5214	cb09b4e0-9caf-46d2-92a5-ec65452200d4	8ba8388f-9907-486c-9883-3784c2f2f34e	t	2026-05-27 19:58:54.005231
e4c69e7c-e9c0-4e9f-9d90-9030354723ee	d263eb62-0c0f-458b-bf31-654549c58655	8ba8388f-9907-486c-9883-3784c2f2f34e	t	2026-05-27 19:58:54.005231
bb5d466c-e88b-460f-b7c4-e41f3a22e955	fe400696-c6f1-4122-b97e-c7f825f39d25	8ba8388f-9907-486c-9883-3784c2f2f34e	t	2026-05-27 19:58:54.005231
80111058-8e7b-42bc-8958-545e4a60c5c5	ff0c234b-4d70-4a86-bce2-b88ce5e0d71e	8ba8388f-9907-486c-9883-3784c2f2f34e	t	2026-05-27 19:58:54.005231
125f0b5f-d1b9-4410-950a-829ce06998ed	b70d1a34-fc31-4bcf-81b1-af36aeb552ab	8ba8388f-9907-486c-9883-3784c2f2f34e	t	2026-05-29 12:16:10.624083
c317f582-fb20-4fa8-a1e5-b347e0001582	3d074d19-5d5d-46fa-b43c-9f1c9f257983	8ba8388f-9907-486c-9883-3784c2f2f34e	t	2026-05-29 14:12:50.213362
2711c0e6-933b-47fa-a18e-1fb55bdb0007	b2b8e045-2b56-46a6-ac1e-77b19b4ba586	8ba8388f-9907-486c-9883-3784c2f2f34e	t	2026-05-29 14:12:50.213362
7f84d767-b52f-4d88-b1c9-265ad0445298	313b3836-dd4c-4bab-8ca1-387b05062ea7	8ba8388f-9907-486c-9883-3784c2f2f34e	t	2026-05-29 18:55:34.741234
\.


--
-- Data for Name: user_roles; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_roles (id, user_id, role_id, organization_id, created_at) FROM stdin;
107f08f6-eb6a-4ddf-952a-906cc1b7ffa7	866bc022-307f-4218-94a3-7622dd2aec79	d8324d5d-995c-4792-947a-22746abd67b1	8ba8388f-9907-486c-9883-3784c2f2f34e	2026-05-21 17:32:02.243855
9c41914f-ebe9-421c-91a9-41d9142021d5	866bc022-307f-4218-94a3-7622dd2aec79	4e1a3ef0-c20a-44e4-a2a5-6bf8587f17bc	8ba8388f-9907-486c-9883-3784c2f2f34e	2026-05-21 17:32:02.246347
5592c800-da78-4f4b-a663-cdb6a40e4463	866bc022-307f-4218-94a3-7622dd2aec79	65aeca86-bd3e-4702-9624-533eef5f3af1	8ba8388f-9907-486c-9883-3784c2f2f34e	2026-05-21 17:32:02.247038
860d6501-e540-4ff7-858a-c5cec8ec6d24	866bc022-307f-4218-94a3-7622dd2aec79	65959336-daaf-4462-ba72-b23fd237d2ad	8ba8388f-9907-486c-9883-3784c2f2f34e	2026-05-21 17:32:02.247993
f2bdfa06-c41c-4d51-9ebf-8ec292867c16	866bc022-307f-4218-94a3-7622dd2aec79	c9905fc3-fa52-4fe0-8d17-638518b49705	8ba8388f-9907-486c-9883-3784c2f2f34e	2026-05-21 17:32:02.248572
bce1cc21-15f0-49cb-b07f-a459862df246	ff0c234b-4d70-4a86-bce2-b88ce5e0d71e	d8324d5d-995c-4792-947a-22746abd67b1	8ba8388f-9907-486c-9883-3784c2f2f34e	2026-05-21 17:32:02.249356
7faaa3b5-af65-4435-8045-553de645b16a	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	4e1a3ef0-c20a-44e4-a2a5-6bf8587f17bc	8ba8388f-9907-486c-9883-3784c2f2f34e	2026-05-21 17:32:02.25006
03e5656a-c221-44cb-ae4d-e47ab8d13f83	50945a5f-b020-461a-8c47-63e74087c228	65aeca86-bd3e-4702-9624-533eef5f3af1	8ba8388f-9907-486c-9883-3784c2f2f34e	2026-05-21 17:32:02.250708
fb4cbe4d-687d-4115-b2a5-0ea5e82673d4	2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	65aeca86-bd3e-4702-9624-533eef5f3af1	8ba8388f-9907-486c-9883-3784c2f2f34e	2026-05-22 00:16:15.6191
b540bc18-9370-4844-87da-5f7a9506dad8	fe400696-c6f1-4122-b97e-c7f825f39d25	d8324d5d-995c-4792-947a-22746abd67b1	8ba8388f-9907-486c-9883-3784c2f2f34e	2026-05-22 00:16:15.620898
0b9d511b-e809-4722-b9b1-845d7102143d	cb09b4e0-9caf-46d2-92a5-ec65452200d4	d8324d5d-995c-4792-947a-22746abd67b1	8ba8388f-9907-486c-9883-3784c2f2f34e	2026-05-22 00:16:15.622033
41aa2898-2cf0-4c43-a478-2e91b6f6c6bf	d263eb62-0c0f-458b-bf31-654549c58655	d8324d5d-995c-4792-947a-22746abd67b1	8ba8388f-9907-486c-9883-3784c2f2f34e	2026-05-22 13:59:20.214118
54c25f4d-fb4d-4397-bdc9-fcd5a22ff9da	c2fd6bc5-5766-4eba-b691-0438f77e3d33	c9905fc3-fa52-4fe0-8d17-638518b49705	8ba8388f-9907-486c-9883-3784c2f2f34e	2026-05-25 13:56:21.522429
5ae02689-fbc7-4d4d-a120-d0993f6354bb	c2fd6bc5-5766-4eba-b691-0438f77e3d33	4e1a3ef0-c20a-44e4-a2a5-6bf8587f17bc	8ba8388f-9907-486c-9883-3784c2f2f34e	2026-05-25 13:56:21.522429
dc07b6b9-7736-42a2-bf0e-096705d59495	c2fd6bc5-5766-4eba-b691-0438f77e3d33	d8324d5d-995c-4792-947a-22746abd67b1	8ba8388f-9907-486c-9883-3784c2f2f34e	2026-05-25 13:56:21.522429
35e111c0-9fb0-4bdf-b546-84b8481964f9	c2fd6bc5-5766-4eba-b691-0438f77e3d33	65aeca86-bd3e-4702-9624-533eef5f3af1	8ba8388f-9907-486c-9883-3784c2f2f34e	2026-05-25 13:56:21.522429
249c9bbd-a42a-4117-8d22-1fd132e274da	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	d8324d5d-995c-4792-947a-22746abd67b1	8ba8388f-9907-486c-9883-3784c2f2f34e	2026-05-25 18:16:23.70851
f48eae19-9b16-4f45-868d-351b95360787	2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	65aeca86-bd3e-4702-9624-533eef5f3af1	8ba8388f-9907-486c-9883-3784c2f2f34e	2026-05-25 18:16:23.712407
2b965763-2633-4077-920b-e6492bd639bf	ff0c234b-4d70-4a86-bce2-b88ce5e0d71e	4e1a3ef0-c20a-44e4-a2a5-6bf8587f17bc	8ba8388f-9907-486c-9883-3784c2f2f34e	2026-05-25 18:19:17.078204
d3cb9354-2fc8-4415-b5fc-c82e070ff23a	ff0c234b-4d70-4a86-bce2-b88ce5e0d71e	65aeca86-bd3e-4702-9624-533eef5f3af1	8ba8388f-9907-486c-9883-3784c2f2f34e	2026-05-25 18:19:17.080621
e718354e-4591-43c0-8726-8e3757df92b1	50945a5f-b020-461a-8c47-63e74087c228	4e1a3ef0-c20a-44e4-a2a5-6bf8587f17bc	8ba8388f-9907-486c-9883-3784c2f2f34e	2026-05-25 18:19:32.307594
b3eba216-3141-4a5e-9d8d-18ee137657fd	50945a5f-b020-461a-8c47-63e74087c228	d8324d5d-995c-4792-947a-22746abd67b1	8ba8388f-9907-486c-9883-3784c2f2f34e	2026-05-25 18:19:32.310024
c5480708-7f77-4fd3-b42b-6ece821c75f4	70d9527d-011a-4548-ab1b-77a9c050e2dd	d8324d5d-995c-4792-947a-22746abd67b1	8ba8388f-9907-486c-9883-3784c2f2f34e	2026-05-25 21:42:41.413589
07be16e5-0eb9-459d-bac7-481112e2d375	70d9527d-011a-4548-ab1b-77a9c050e2dd	4e1a3ef0-c20a-44e4-a2a5-6bf8587f17bc	8ba8388f-9907-486c-9883-3784c2f2f34e	2026-05-25 21:42:41.413589
848f02e8-9c15-47f2-a879-682cec361bc4	70d9527d-011a-4548-ab1b-77a9c050e2dd	65aeca86-bd3e-4702-9624-533eef5f3af1	8ba8388f-9907-486c-9883-3784c2f2f34e	2026-05-25 21:42:41.413589
da6c407e-b5df-4178-a280-2cdcdad1f983	70d9527d-011a-4548-ab1b-77a9c050e2dd	65959336-daaf-4462-ba72-b23fd237d2ad	8ba8388f-9907-486c-9883-3784c2f2f34e	2026-05-25 21:42:41.413589
a1c06cce-d4bc-4518-9a2e-a9143d0dcac5	6e38cbca-9dc0-4b75-98f8-6ebbe508c90d	65959336-daaf-4462-ba72-b23fd237d2ad	8ba8388f-9907-486c-9883-3784c2f2f34e	2026-05-27 17:38:05.92594
0f5a1cef-0264-493f-b49b-658d8f9c90a2	313b3836-dd4c-4bab-8ca1-387b05062ea7	d8324d5d-995c-4792-947a-22746abd67b1	8ba8388f-9907-486c-9883-3784c2f2f34e	2026-05-29 18:39:36.170882
e8757193-ec90-499c-8f05-b8e2b8126d0d	b70d1a34-fc31-4bcf-81b1-af36aeb552ab	d8324d5d-995c-4792-947a-22746abd67b1	8ba8388f-9907-486c-9883-3784c2f2f34e	2026-05-29 11:59:06.970943
b903e7f5-b791-4730-a235-7cc682aad6c1	3d074d19-5d5d-46fa-b43c-9f1c9f257983	d8324d5d-995c-4792-947a-22746abd67b1	8ba8388f-9907-486c-9883-3784c2f2f34e	2026-05-29 12:20:17.657766
c1b496d8-556f-4129-97db-6f2148c1ed75	b2b8e045-2b56-46a6-ac1e-77b19b4ba586	65aeca86-bd3e-4702-9624-533eef5f3af1	8ba8388f-9907-486c-9883-3784c2f2f34e	2026-05-29 12:21:54.90737
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, first_name, last_name, email, mobile_number, password_hash, gender, date_of_birth, education, class_level, profile_image, is_active, is_verified, last_login_at, active_role, created_at, updated_at, deleted_at, branch, primary_organization_id, unique_registration_id) FROM stdin;
866bc022-307f-4218-94a3-7622dd2aec79	ELS	Super User	super@els.ai	\N	$2b$10$iwWOXu6KgBAEVbvnxvXew.rK3S4wCVIOkr6cX5EmBEli03nVmvz4i	\N	\N	\N	\N	\N	t	f	\N	superadmin	2026-05-21 17:32:02.241501	2026-05-29 17:01:02.492613	\N	\N	8ba8388f-9907-486c-9883-3784c2f2f34e	ELS-0621491B6E
6e38cbca-9dc0-4b75-98f8-6ebbe508c90d	ELS	Org Admin	admin@els.ai	\N	$2b$10$UcDigpYobBZe3cD4AY3YO.rE0O6.OaHfWxXEIapW4ZnGYGGQh.vTW	\N	\N	\N	\N	\N	t	f	\N	admin	2026-05-27 16:22:34.658017	2026-05-29 17:01:02.550126	\N	\N	8ba8388f-9907-486c-9883-3784c2f2f34e	ELS-1BF0AA301E
2bb3d34c-4eae-46bd-8f24-cf1c9096ac70	ELS	Teacher	teacher@els.ai	\N	$2b$10$92ccIieCL5IaWBiUxHp/d.Uye2AiXLLROrmpTGk8Swsc/SyDsDSTS	\N	\N	\N	\N	\N	t	f	\N	teacher	2026-05-21 17:32:02.249739	2026-05-25 18:41:43.917545	\N	\N	8ba8388f-9907-486c-9883-3784c2f2f34e	ELS-6F794F5C5B
2f7c36ee-aec8-430d-b5e8-ea3b37f4c61c	Ramesh	Kumar	ramesh@els.ai	9876543210	$2b$10$60jEdswku21eocGbwdJrJe170qlwedBaxJ15ydkoOCSnGp3kWr8oe	\N	\N	\N	\N	\N	t	f	\N	parent	2026-05-22 00:16:15.61705	2026-05-22 00:16:15.61705	\N	\N	8ba8388f-9907-486c-9883-3784c2f2f34e	ELS-69B828FC5F
50945a5f-b020-461a-8c47-63e74087c228	ELS	Parent	parent@els.ai	\N	$2b$10$92ccIieCL5IaWBiUxHp/d.Uye2AiXLLROrmpTGk8Swsc/SyDsDSTS	\N	\N	\N	\N	\N	t	f	\N	parent	2026-05-21 17:32:02.250356	2026-05-25 18:19:35.48348	\N	\N	8ba8388f-9907-486c-9883-3784c2f2f34e	ELS-7F97B4918D
70d9527d-011a-4548-ab1b-77a9c050e2dd	Hcm	Emeelan	hcm@emeelan.com	\N	$2a$10$JymBFlBuKpzUVY3qikKXyexl3tXWxe0a4vpjR5RMM0gASCC2Cus0y	\N	\N	\N	\N	\N	t	t	\N	teacher	2026-05-25 21:42:41.413589	2026-05-25 21:42:41.418535	\N	\N	8ba8388f-9907-486c-9883-3784c2f2f34e	ELS-7E5C3F1282
c2fd6bc5-5766-4eba-b691-0438f77e3d33	Harish	Muleva	hbm@emeelan.com	\N	$2b$10$SqZ.8e53/t5q5C/23s9Yo.ZM/eePuCMObYAV2jdEpiahASHpx.kPm	\N	\N	\N	\N	\N	t	t	\N	parent	2026-05-25 13:56:21.522429	2026-05-25 13:56:21.522429	\N	\N	8ba8388f-9907-486c-9883-3784c2f2f34e	ELS-BFC4E89D70
cb09b4e0-9caf-46d2-92a5-ec65452200d4	Mohan	Kumar	mohan@els.ai	9876543212	$2b$10$60jEdswku21eocGbwdJrJe170qlwedBaxJ15ydkoOCSnGp3kWr8oe	\N	\N	\N	2	\N	t	f	\N	student	2026-05-22 00:16:15.621567	2026-05-22 00:16:15.621567	\N	\N	8ba8388f-9907-486c-9883-3784c2f2f34e	ELS-F8413EC6A5
d263eb62-0c0f-458b-bf31-654549c58655	hcm3	test	hcm3@els.ai	9845400324	$2b$10$RsLPQNNVmwE/8VJC9yfvyOGVF4lSORS2mwL1sibrWhYvGSnwqLMxe	\N	\N	\N	3	\N	t	f	\N	student	2026-05-22 13:59:20.211175	2026-05-22 13:59:20.211175	\N	\N	8ba8388f-9907-486c-9883-3784c2f2f34e	ELS-4806B5DD97
fe400696-c6f1-4122-b97e-c7f825f39d25	Rahul	Kumar	rahul@els.ai	9876543211	$2b$10$60jEdswku21eocGbwdJrJe170qlwedBaxJ15ydkoOCSnGp3kWr8oe	\N	\N	\N	1	\N	t	f	\N	student	2026-05-22 00:16:15.620401	2026-05-22 00:16:15.620401	\N	\N	8ba8388f-9907-486c-9883-3784c2f2f34e	ELS-DD327EF120
ff0c234b-4d70-4a86-bce2-b88ce5e0d71e	ELS	Student	student@els.ai	\N	$2b$10$92ccIieCL5IaWBiUxHp/d.Uye2AiXLLROrmpTGk8Swsc/SyDsDSTS	\N	\N	\N	1	\N	t	f	\N	student	2026-05-21 17:32:02.248976	2026-05-25 18:19:17.081331	\N	\N	8ba8388f-9907-486c-9883-3784c2f2f34e	ELS-E698FFC8BA
b70d1a34-fc31-4bcf-81b1-af36aeb552ab	dhruv	rathore	9845400321@els.ai	9845400321	$2b$10$RYw7Hk3zOjkYADv/6egZhOGZH4kV9LLd645sc4zGvBzPSCImvSi8q	\N	\N	\N	1	\N	t	f	\N	student	2026-05-29 11:59:06.962971	2026-05-29 11:59:06.962971	\N	\N	8ba8388f-9907-486c-9883-3784c2f2f34e	ELS-D2F713EC84
3d074d19-5d5d-46fa-b43c-9f1c9f257983	hkc	welcome	98454002@a.com	\N	$2b$10$GmwIWoU.3jZ.SS6XUtYyROgUjKSwvu2rsf/qATmAEpDDEu7HxDBGa	\N	\N	\N	3	\N	t	f	\N	student	2026-05-29 12:20:17.657766	2026-05-29 12:20:17.657766	\N	\N	8ba8388f-9907-486c-9883-3784c2f2f34e	ELS-1B4E26BC91
b2b8e045-2b56-46a6-ac1e-77b19b4ba586	bhanu	rathore	98454003002@b.com	\N	$2b$10$G9mX2HpYzW.Gr04MR92PXuAxiMMlOU3MmdJJHa3OuOkTHj9y/4lym	\N	\N	\N	\N	\N	t	f	\N	parent	2026-05-29 12:21:54.90737	2026-05-29 12:21:54.90737	\N	\N	8ba8388f-9907-486c-9883-3784c2f2f34e	ELS-AFD08F186A
313b3836-dd4c-4bab-8ca1-387b05062ea7	Kartik	Pawar	kartik@els.ai	8722829101	$2b$10$dWIXBxJ6roKzKvgYvo/qCu6YT9fBJlnvD/Pkv1xZOvaf1yPOKIjYe	\N	\N	\N	LKG	\N	t	f	\N	student	2026-05-29 18:39:36.170882	2026-05-29 18:39:36.170882	\N	\N	8ba8388f-9907-486c-9883-3784c2f2f34e	ELS-4EA2B3F46A
\.


--
-- Name: achievements achievements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.achievements
    ADD CONSTRAINT achievements_pkey PRIMARY KEY (id);


--
-- Name: assets assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_pkey PRIMARY KEY (id);


--
-- Name: assignment_submissions assignment_submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignment_submissions
    ADD CONSTRAINT assignment_submissions_pkey PRIMARY KEY (id);


--
-- Name: classroom_assignment_submissions classroom_assignment_submissi_classroom_assignment_id_stude_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classroom_assignment_submissions
    ADD CONSTRAINT classroom_assignment_submissi_classroom_assignment_id_stude_key UNIQUE (classroom_assignment_id, student_id);


--
-- Name: classroom_assignment_submissions classroom_assignment_submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classroom_assignment_submissions
    ADD CONSTRAINT classroom_assignment_submissions_pkey PRIMARY KEY (id);


--
-- Name: classroom_assignments classroom_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classroom_assignments
    ADD CONSTRAINT classroom_assignments_pkey PRIMARY KEY (id);


--
-- Name: classroom_contents classroom_contents_classroom_id_content_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classroom_contents
    ADD CONSTRAINT classroom_contents_classroom_id_content_id_key UNIQUE (classroom_id, content_id);


--
-- Name: classroom_contents classroom_contents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classroom_contents
    ADD CONSTRAINT classroom_contents_pkey PRIMARY KEY (id);


--
-- Name: classroom_quizzes classroom_quizzes_classroom_id_quiz_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classroom_quizzes
    ADD CONSTRAINT classroom_quizzes_classroom_id_quiz_id_key UNIQUE (classroom_id, quiz_id);


--
-- Name: classroom_quizzes classroom_quizzes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classroom_quizzes
    ADD CONSTRAINT classroom_quizzes_pkey PRIMARY KEY (id);


--
-- Name: classroom_student_remarks classroom_student_remarks_classroom_id_student_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classroom_student_remarks
    ADD CONSTRAINT classroom_student_remarks_classroom_id_student_id_key UNIQUE (classroom_id, student_id);


--
-- Name: classroom_student_remarks classroom_student_remarks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classroom_student_remarks
    ADD CONSTRAINT classroom_student_remarks_pkey PRIMARY KEY (id);


--
-- Name: classrooms classrooms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classrooms
    ADD CONSTRAINT classrooms_pkey PRIMARY KEY (id);


--
-- Name: content_topics content_topics_organization_id_class_level_subject_title_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_topics
    ADD CONSTRAINT content_topics_organization_id_class_level_subject_title_key UNIQUE (organization_id, class_level, subject, title);


--
-- Name: content_topics content_topics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_topics
    ADD CONSTRAINT content_topics_pkey PRIMARY KEY (id);


--
-- Name: invoices invoices_invoice_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_invoice_number_key UNIQUE (invoice_number);


--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);


--
-- Name: learning_content_sections learning_content_sections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_content_sections
    ADD CONSTRAINT learning_content_sections_pkey PRIMARY KEY (id);


--
-- Name: learning_contents learning_contents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_contents
    ADD CONSTRAINT learning_contents_pkey PRIMARY KEY (id);


--
-- Name: notification_preferences notification_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_pkey PRIMARY KEY (user_id);


--
-- Name: notification_schedules notification_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_schedules
    ADD CONSTRAINT notification_schedules_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: organization_subscriptions organization_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_subscriptions
    ADD CONSTRAINT organization_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_subdomain_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_subdomain_key UNIQUE (subdomain);


--
-- Name: parent_assessments parent_assessments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parent_assessments
    ADD CONSTRAINT parent_assessments_pkey PRIMARY KEY (id);


--
-- Name: parent_feedback parent_feedback_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parent_feedback
    ADD CONSTRAINT parent_feedback_pkey PRIMARY KEY (id);


--
-- Name: parent_student_links parent_student_links_parent_user_id_student_user_id_organiz_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parent_student_links
    ADD CONSTRAINT parent_student_links_parent_user_id_student_user_id_organiz_key UNIQUE (parent_user_id, student_user_id, organization_id);


--
-- Name: parent_student_links parent_student_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parent_student_links
    ADD CONSTRAINT parent_student_links_pkey PRIMARY KEY (id);


--
-- Name: question_attempts question_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.question_attempts
    ADD CONSTRAINT question_attempts_pkey PRIMARY KEY (id);


--
-- Name: quiz_questions quiz_questions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_questions
    ADD CONSTRAINT quiz_questions_pkey PRIMARY KEY (id);


--
-- Name: quizzes quizzes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quizzes
    ADD CONSTRAINT quizzes_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: roles roles_role_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_role_name_key UNIQUE (role_name);


--
-- Name: stories stories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stories
    ADD CONSTRAINT stories_pkey PRIMARY KEY (id);


--
-- Name: story_progress story_progress_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.story_progress
    ADD CONSTRAINT story_progress_pkey PRIMARY KEY (id);


--
-- Name: story_progress story_progress_user_id_story_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.story_progress
    ADD CONSTRAINT story_progress_user_id_story_id_key UNIQUE (user_id, story_id);


--
-- Name: story_sections story_sections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.story_sections
    ADD CONSTRAINT story_sections_pkey PRIMARY KEY (id);


--
-- Name: student_achievements student_achievements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_achievements
    ADD CONSTRAINT student_achievements_pkey PRIMARY KEY (id);


--
-- Name: student_activity student_activity_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_activity
    ADD CONSTRAINT student_activity_pkey PRIMARY KEY (id);


--
-- Name: student_analytics student_analytics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_analytics
    ADD CONSTRAINT student_analytics_pkey PRIMARY KEY (id);


--
-- Name: student_analytics student_analytics_student_id_analytics_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_analytics
    ADD CONSTRAINT student_analytics_student_id_analytics_date_key UNIQUE (student_id, analytics_date);


--
-- Name: student_attempts student_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_attempts
    ADD CONSTRAINT student_attempts_pkey PRIMARY KEY (id);


--
-- Name: subjects subjects_organization_id_class_level_title_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subjects
    ADD CONSTRAINT subjects_organization_id_class_level_title_key UNIQUE (organization_id, class_level, title);


--
-- Name: subjects subjects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subjects
    ADD CONSTRAINT subjects_pkey PRIMARY KEY (id);


--
-- Name: subscription_plans subscription_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_plans
    ADD CONSTRAINT subscription_plans_pkey PRIMARY KEY (id);


--
-- Name: teacher_standard_subjects teacher_standard_subjects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teacher_standard_subjects
    ADD CONSTRAINT teacher_standard_subjects_pkey PRIMARY KEY (id);


--
-- Name: teacher_standard_subjects teacher_standard_subjects_teacher_user_id_organization_id_c_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teacher_standard_subjects
    ADD CONSTRAINT teacher_standard_subjects_teacher_user_id_organization_id_c_key UNIQUE (teacher_user_id, organization_id, class_level, subject);


--
-- Name: topic_content_assignments topic_content_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.topic_content_assignments
    ADD CONSTRAINT topic_content_assignments_pkey PRIMARY KEY (id);


--
-- Name: topic_content_assignments topic_content_assignments_topic_id_content_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.topic_content_assignments
    ADD CONSTRAINT topic_content_assignments_topic_id_content_id_key UNIQUE (topic_id, content_id);


--
-- Name: topic_content_sections topic_content_sections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.topic_content_sections
    ADD CONSTRAINT topic_content_sections_pkey PRIMARY KEY (id);


--
-- Name: user_global_publish_permissions user_global_publish_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_global_publish_permissions
    ADD CONSTRAINT user_global_publish_permissions_pkey PRIMARY KEY (id);


--
-- Name: user_global_publish_permissions user_global_publish_permissions_user_id_organization_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_global_publish_permissions
    ADD CONSTRAINT user_global_publish_permissions_user_id_organization_id_key UNIQUE (user_id, organization_id);


--
-- Name: user_org_mapping user_org_mapping_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_org_mapping
    ADD CONSTRAINT user_org_mapping_pkey PRIMARY KEY (id);


--
-- Name: user_org_mapping user_org_mapping_user_id_organization_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_org_mapping
    ADD CONSTRAINT user_org_mapping_user_id_organization_id_key UNIQUE (user_id, organization_id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_id_organization_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_id_organization_id_key UNIQUE (user_id, role_id, organization_id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_mobile_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_mobile_number_key UNIQUE (mobile_number);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: idx_achievements_unique_identity; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_achievements_unique_identity ON public.achievements USING btree (COALESCE((organization_id)::text, 'global'::text), lower((name)::text), is_global);


--
-- Name: idx_invoices_issued; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_issued ON public.invoices USING btree (issued_at DESC);


--
-- Name: idx_invoices_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_org ON public.invoices USING btree (organization_id);


--
-- Name: idx_invoices_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_status ON public.invoices USING btree (status);


--
-- Name: idx_notif_expiry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notif_expiry ON public.notifications USING btree (expiry_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_notif_idem; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_notif_idem ON public.notifications USING btree (user_id, source_event_id, type) WHERE (source_event_id IS NOT NULL);


--
-- Name: idx_notif_user_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notif_user_active ON public.notifications USING btree (user_id, status, created_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_sched_due; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sched_due ON public.notification_schedules USING btree (fire_at) WHERE ((status)::text = 'pending'::text);


--
-- Name: idx_student_achievements_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_student_achievements_unique ON public.student_achievements USING btree (student_id, classroom_id, achievement_id);


--
-- Name: idx_subscription_plans_identity; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_subscription_plans_identity ON public.subscription_plans USING btree (name, membership_tier, billing_cycle);


--
-- Name: idx_uom_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_uom_org ON public.user_org_mapping USING btree (organization_id);


--
-- Name: idx_uom_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_uom_user ON public.user_org_mapping USING btree (user_id);


--
-- Name: idx_users_unique_registration_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_users_unique_registration_id ON public.users USING btree (unique_registration_id);


--
-- Name: stories_live_published_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stories_live_published_idx ON public.stories USING btree (published_at) WHERE (status = 'live'::text);


--
-- Name: stories_org_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stories_org_status_idx ON public.stories USING btree (organization_id, status);


--
-- Name: stories_scheduled_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stories_scheduled_idx ON public.stories USING btree (scheduled_at) WHERE (status = 'scheduled'::text);


--
-- Name: story_progress_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX story_progress_user_idx ON public.story_progress USING btree (user_id);


--
-- Name: story_sections_story_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX story_sections_story_order_idx ON public.story_sections USING btree (story_id, order_index);


--
-- Name: uq_one_default_org; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_one_default_org ON public.organizations USING btree (is_default) WHERE (is_default = true);


--
-- Name: uq_uom_primary; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_uom_primary ON public.user_org_mapping USING btree (user_id) WHERE (is_primary = true);


--
-- Name: assignment_submissions assignment_submissions_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignment_submissions
    ADD CONSTRAINT assignment_submissions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: assignment_submissions assignment_submissions_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignment_submissions
    ADD CONSTRAINT assignment_submissions_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: classroom_assignment_submissions classroom_assignment_submissions_classroom_assignment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classroom_assignment_submissions
    ADD CONSTRAINT classroom_assignment_submissions_classroom_assignment_id_fkey FOREIGN KEY (classroom_assignment_id) REFERENCES public.classroom_assignments(id) ON DELETE CASCADE;


--
-- Name: classroom_assignments classroom_assignments_classroom_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classroom_assignments
    ADD CONSTRAINT classroom_assignments_classroom_id_fkey FOREIGN KEY (classroom_id) REFERENCES public.classrooms(id) ON DELETE CASCADE;


--
-- Name: classroom_contents classroom_contents_classroom_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classroom_contents
    ADD CONSTRAINT classroom_contents_classroom_id_fkey FOREIGN KEY (classroom_id) REFERENCES public.classrooms(id) ON DELETE CASCADE;


--
-- Name: classroom_quizzes classroom_quizzes_classroom_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classroom_quizzes
    ADD CONSTRAINT classroom_quizzes_classroom_id_fkey FOREIGN KEY (classroom_id) REFERENCES public.classrooms(id) ON DELETE CASCADE;


--
-- Name: classroom_student_remarks classroom_student_remarks_classroom_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classroom_student_remarks
    ADD CONSTRAINT classroom_student_remarks_classroom_id_fkey FOREIGN KEY (classroom_id) REFERENCES public.classrooms(id) ON DELETE CASCADE;


--
-- Name: content_topics content_topics_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_topics
    ADD CONSTRAINT content_topics_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: content_topics content_topics_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_topics
    ADD CONSTRAINT content_topics_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: invoices invoices_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: invoices invoices_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.subscription_plans(id) ON DELETE SET NULL;


--
-- Name: invoices invoices_subscription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.organization_subscriptions(id) ON DELETE SET NULL;


--
-- Name: learning_content_sections learning_content_sections_content_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_content_sections
    ADD CONSTRAINT learning_content_sections_content_id_fkey FOREIGN KEY (content_id) REFERENCES public.learning_contents(id) ON DELETE CASCADE;


--
-- Name: learning_contents learning_contents_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_contents
    ADD CONSTRAINT learning_contents_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: learning_contents learning_contents_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_contents
    ADD CONSTRAINT learning_contents_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: organization_subscriptions organization_subscriptions_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_subscriptions
    ADD CONSTRAINT organization_subscriptions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: organization_subscriptions organization_subscriptions_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_subscriptions
    ADD CONSTRAINT organization_subscriptions_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.subscription_plans(id) ON DELETE SET NULL;


--
-- Name: parent_assessments parent_assessments_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parent_assessments
    ADD CONSTRAINT parent_assessments_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: parent_assessments parent_assessments_parent_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parent_assessments
    ADD CONSTRAINT parent_assessments_parent_user_id_fkey FOREIGN KEY (parent_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: parent_assessments parent_assessments_student_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parent_assessments
    ADD CONSTRAINT parent_assessments_student_user_id_fkey FOREIGN KEY (student_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: parent_feedback parent_feedback_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parent_feedback
    ADD CONSTRAINT parent_feedback_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: parent_feedback parent_feedback_parent_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parent_feedback
    ADD CONSTRAINT parent_feedback_parent_user_id_fkey FOREIGN KEY (parent_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: parent_feedback parent_feedback_student_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parent_feedback
    ADD CONSTRAINT parent_feedback_student_user_id_fkey FOREIGN KEY (student_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: parent_student_links parent_student_links_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parent_student_links
    ADD CONSTRAINT parent_student_links_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: parent_student_links parent_student_links_parent_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parent_student_links
    ADD CONSTRAINT parent_student_links_parent_user_id_fkey FOREIGN KEY (parent_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: parent_student_links parent_student_links_student_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parent_student_links
    ADD CONSTRAINT parent_student_links_student_user_id_fkey FOREIGN KEY (student_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: question_attempts question_attempts_attempt_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.question_attempts
    ADD CONSTRAINT question_attempts_attempt_id_fkey FOREIGN KEY (attempt_id) REFERENCES public.student_attempts(id) ON DELETE CASCADE;


--
-- Name: question_attempts question_attempts_question_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.question_attempts
    ADD CONSTRAINT question_attempts_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.quiz_questions(id) ON DELETE CASCADE;


--
-- Name: quiz_questions quiz_questions_quiz_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_questions
    ADD CONSTRAINT quiz_questions_quiz_id_fkey FOREIGN KEY (quiz_id) REFERENCES public.quizzes(id) ON DELETE CASCADE;


--
-- Name: quizzes quizzes_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quizzes
    ADD CONSTRAINT quizzes_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: quizzes quizzes_topic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quizzes
    ADD CONSTRAINT quizzes_topic_id_fkey FOREIGN KEY (topic_id) REFERENCES public.content_topics(id) ON DELETE SET NULL;


--
-- Name: refresh_tokens refresh_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: story_progress story_progress_story_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.story_progress
    ADD CONSTRAINT story_progress_story_id_fkey FOREIGN KEY (story_id) REFERENCES public.stories(id) ON DELETE CASCADE;


--
-- Name: story_sections story_sections_story_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.story_sections
    ADD CONSTRAINT story_sections_story_id_fkey FOREIGN KEY (story_id) REFERENCES public.stories(id) ON DELETE CASCADE;


--
-- Name: student_achievements student_achievements_achievement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_achievements
    ADD CONSTRAINT student_achievements_achievement_id_fkey FOREIGN KEY (achievement_id) REFERENCES public.achievements(id) ON DELETE CASCADE;


--
-- Name: student_achievements student_achievements_classroom_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_achievements
    ADD CONSTRAINT student_achievements_classroom_id_fkey FOREIGN KEY (classroom_id) REFERENCES public.classrooms(id) ON DELETE CASCADE;


--
-- Name: student_activity student_activity_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_activity
    ADD CONSTRAINT student_activity_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: student_activity student_activity_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_activity
    ADD CONSTRAINT student_activity_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: student_analytics student_analytics_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_analytics
    ADD CONSTRAINT student_analytics_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: student_analytics student_analytics_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_analytics
    ADD CONSTRAINT student_analytics_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: student_attempts student_attempts_quiz_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_attempts
    ADD CONSTRAINT student_attempts_quiz_id_fkey FOREIGN KEY (quiz_id) REFERENCES public.quizzes(id) ON DELETE CASCADE;


--
-- Name: student_attempts student_attempts_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_attempts
    ADD CONSTRAINT student_attempts_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: subjects subjects_author_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subjects
    ADD CONSTRAINT subjects_author_user_id_fkey FOREIGN KEY (author_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: subjects subjects_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subjects
    ADD CONSTRAINT subjects_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: teacher_standard_subjects teacher_standard_subjects_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teacher_standard_subjects
    ADD CONSTRAINT teacher_standard_subjects_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: teacher_standard_subjects teacher_standard_subjects_teacher_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teacher_standard_subjects
    ADD CONSTRAINT teacher_standard_subjects_teacher_user_id_fkey FOREIGN KEY (teacher_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: topic_content_assignments topic_content_assignments_content_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.topic_content_assignments
    ADD CONSTRAINT topic_content_assignments_content_id_fkey FOREIGN KEY (content_id) REFERENCES public.learning_contents(id) ON DELETE CASCADE;


--
-- Name: topic_content_assignments topic_content_assignments_topic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.topic_content_assignments
    ADD CONSTRAINT topic_content_assignments_topic_id_fkey FOREIGN KEY (topic_id) REFERENCES public.content_topics(id) ON DELETE CASCADE;


--
-- Name: topic_content_sections topic_content_sections_topic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.topic_content_sections
    ADD CONSTRAINT topic_content_sections_topic_id_fkey FOREIGN KEY (topic_id) REFERENCES public.content_topics(id) ON DELETE CASCADE;


--
-- Name: user_global_publish_permissions user_global_publish_permissions_granted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_global_publish_permissions
    ADD CONSTRAINT user_global_publish_permissions_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: user_global_publish_permissions user_global_publish_permissions_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_global_publish_permissions
    ADD CONSTRAINT user_global_publish_permissions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: user_global_publish_permissions user_global_publish_permissions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_global_publish_permissions
    ADD CONSTRAINT user_global_publish_permissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_org_mapping user_org_mapping_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_org_mapping
    ADD CONSTRAINT user_org_mapping_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: user_org_mapping user_org_mapping_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_org_mapping
    ADD CONSTRAINT user_org_mapping_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: users users_primary_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_primary_organization_id_fkey FOREIGN KEY (primary_organization_id) REFERENCES public.organizations(id);


--
-- PostgreSQL database dump complete
--

\unrestrict d8Z7vltaDCe2pMUFALA4h0B59I1h8xou13ncgB1pFLshh0LMXwlkUJdCnKefB10

