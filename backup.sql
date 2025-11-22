--
-- PostgreSQL database dump
--

\restrict P91qzxgbm17K7mJu2v56dsP7OCqZzgOj48a7jgzZwnZoru55qjVSVPUJlakpfRx

-- Dumped from database version 15.14
-- Dumped by pg_dump version 15.14

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: cartenz_admin
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO cartenz_admin;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: bookings; Type: TABLE; Schema: public; Owner: cartenz_admin
--

CREATE TABLE public.bookings (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    booking_code character varying(50) NOT NULL,
    user_id uuid,
    service_type character varying(50) NOT NULL,
    open_trip_id uuid,
    mountain_id uuid,
    guide_id uuid,
    porter_id uuid,
    customer_name character varying(255) NOT NULL,
    customer_email character varying(255) NOT NULL,
    customer_phone character varying(20) NOT NULL,
    emergency_contact character varying(20) NOT NULL,
    address text,
    start_date date NOT NULL,
    end_date date,
    duration character varying(50),
    total_participants integer NOT NULL,
    need_porter boolean DEFAULT false,
    need_documentation boolean DEFAULT false,
    need_equipment boolean DEFAULT false,
    need_transport boolean DEFAULT false,
    dietary_requirements text,
    medical_conditions text,
    special_requests text,
    base_price integer NOT NULL,
    additional_services_price integer DEFAULT 0,
    insurance_price integer DEFAULT 0,
    admin_fee integer DEFAULT 0,
    total_price integer NOT NULL,
    payment_method character varying(50),
    payment_status character varying(50) DEFAULT 'pending'::character varying,
    payment_invoice_url text,
    payment_external_id character varying(255),
    paid_at timestamp without time zone,
    status character varying(50) DEFAULT 'pending'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    booking_status character varying(50) DEFAULT 'pending'::character varying
);


ALTER TABLE public.bookings OWNER TO cartenz_admin;

--
-- Name: guides; Type: TABLE; Schema: public; Owner: cartenz_admin
--

CREATE TABLE public.guides (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    title character varying(255),
    experience_years integer NOT NULL,
    rating numeric(2,1) DEFAULT 0.0,
    total_reviews integer DEFAULT 0,
    total_trips integer DEFAULT 0,
    languages text[],
    specialties text[],
    price_per_day integer NOT NULL,
    avatar_url text,
    description text,
    achievements text[],
    is_verified boolean DEFAULT true,
    is_available boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    photo character varying(255)
);


ALTER TABLE public.guides OWNER TO cartenz_admin;

--
-- Name: mountains; Type: TABLE; Schema: public; Owner: cartenz_admin
--

CREATE TABLE public.mountains (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    location character varying(255) NOT NULL,
    altitude integer,
    difficulty character varying(50),
    description text,
    image_url text,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.mountains OWNER TO cartenz_admin;

--
-- Name: open_trip_schedules; Type: TABLE; Schema: public; Owner: cartenz_admin
--

CREATE TABLE public.open_trip_schedules (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    open_trip_id uuid,
    start_date date NOT NULL,
    end_date date NOT NULL,
    current_participants integer DEFAULT 0,
    status character varying(50) DEFAULT 'available'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.open_trip_schedules OWNER TO cartenz_admin;

--
-- Name: open_trips; Type: TABLE; Schema: public; Owner: cartenz_admin
--

CREATE TABLE public.open_trips (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    title character varying(255) NOT NULL,
    mountain_id uuid,
    duration_days integer NOT NULL,
    duration_nights integer NOT NULL,
    difficulty character varying(50),
    base_price integer NOT NULL,
    original_price integer,
    min_participants integer DEFAULT 1,
    max_participants integer NOT NULL,
    description text,
    image_url text,
    includes text[],
    highlights text[],
    itinerary jsonb,
    rating numeric(2,1) DEFAULT 0.0,
    total_reviews integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    quota_remaining integer DEFAULT 0,
    is_closed boolean DEFAULT false
);


ALTER TABLE public.open_trips OWNER TO cartenz_admin;

--
-- Name: payments; Type: TABLE; Schema: public; Owner: cartenz_admin
--

CREATE TABLE public.payments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    booking_id uuid,
    external_id character varying(255),
    invoice_url text,
    amount integer NOT NULL,
    payment_method character varying(50),
    payment_channel character varying(50),
    status character varying(50) DEFAULT 'pending'::character varying,
    paid_at timestamp without time zone,
    expired_at timestamp without time zone,
    metadata jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.payments OWNER TO cartenz_admin;

--
-- Name: porters; Type: TABLE; Schema: public; Owner: cartenz_admin
--

CREATE TABLE public.porters (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    experience_years integer NOT NULL,
    rating numeric(2,1) DEFAULT 0.0,
    total_reviews integer DEFAULT 0,
    total_trips integer DEFAULT 0,
    max_capacity_kg integer NOT NULL,
    specialties text[],
    price_per_day integer NOT NULL,
    avatar_url text,
    description text,
    achievements text[],
    is_available boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    photo character varying(255)
);


ALTER TABLE public.porters OWNER TO cartenz_admin;

--
-- Name: reviews; Type: TABLE; Schema: public; Owner: cartenz_admin
--

CREATE TABLE public.reviews (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    booking_id uuid,
    user_id uuid,
    guide_id uuid,
    porter_id uuid,
    open_trip_id uuid,
    rating integer,
    title character varying(255),
    comment text,
    images text[],
    is_verified boolean DEFAULT false,
    is_published boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);


ALTER TABLE public.reviews OWNER TO cartenz_admin;

--
-- Name: users; Type: TABLE; Schema: public; Owner: cartenz_admin
--

CREATE TABLE public.users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    full_name character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    phone character varying(20) NOT NULL,
    password_hash character varying(255) NOT NULL,
    avatar_url text,
    role character varying(50) DEFAULT 'customer'::character varying,
    is_verified boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.users OWNER TO cartenz_admin;

--
-- Data for Name: bookings; Type: TABLE DATA; Schema: public; Owner: cartenz_admin
--

COPY public.bookings (id, booking_code, user_id, service_type, open_trip_id, mountain_id, guide_id, porter_id, customer_name, customer_email, customer_phone, emergency_contact, address, start_date, end_date, duration, total_participants, need_porter, need_documentation, need_equipment, need_transport, dietary_requirements, medical_conditions, special_requests, base_price, additional_services_price, insurance_price, admin_fee, total_price, payment_method, payment_status, payment_invoice_url, payment_external_id, paid_at, status, created_at, updated_at, booking_status) FROM stdin;
2b0cff69-eb25-4a16-a466-debcd04846e8	ORDER-1762860035627	\N	open-trip	\N	\N	\N	\N	Angungg	ashabulbuull03@gmail.com	085215667197	0823123234384	\N	2025-11-29	\N	\N	2	t	f	f	f	saya alarge bebek	sadsadsa		0	1600000	50000	15000	1665000	\N	pending	\N	\N	\N	pending	2025-11-11 11:20:35.73979	2025-11-11 11:20:35.73979	pending
55845ccc-2334-440f-8bbd-9e62e9075dd1	ORDER-1763692120318	27fbb478-a580-46f8-b9cb-1aa566b87cba	private-trip	\N	\N	\N	\N	afiq	ikki0909@gmail.com	085215667197		\N	2025-12-06	\N	\N	2	t	f	f	f	saya alarge bebek	sadsadsa		299999	1599996	50000	15000	2264994	\N	pending	\N	e0c949df-0344-4974-8e18-7f121baee804	\N	pending	2025-11-21 02:28:42.853951	2025-11-21 02:28:48.250541	pending
2d2a2dc2-367c-4e59-9a56-2e042a278b23	ORDER-1763549026298	27fbb478-a580-46f8-b9cb-1aa566b87cba	open-trip	\N	\N	\N	\N	ikki	ikki0102@gmail.com	085215667197		\N	2025-12-06	\N	\N	1	t	f	f	f	saya alarge bebek	sadsadsa		0	1599996	25000	15000	1639996	\N	pending	\N	\N	\N	pending	2025-11-19 10:43:46.397084	2025-11-19 10:43:46.397084	pending
20a8a79f-e5d5-404a-a60f-15f11ed7ce00	ORDER-1763550883548	27fbb478-a580-46f8-b9cb-1aa566b87cba	open-trip	\N	\N	\N	\N	ikki	ikki0102@gmail.com	085215667197		\N	2025-12-06	\N	\N	5	f	f	f	f	saya alarge bebek	sadsadsa		0	0	125000	15000	140000	\N	pending	\N	\N	\N	pending	2025-11-19 11:14:43.608782	2025-11-19 11:14:43.608782	pending
2d40c0bc-d760-4c5e-9e4a-81e88e27641a	ORDER-1763634685546	27fbb478-a580-46f8-b9cb-1aa566b87cba	open-trip	\N	\N	\N	\N	afiq	ikki0909@gmail.com	085215667197		\N	2025-12-06	\N	\N	2	t	t	f	f	saya alarge bebek	sadsadsa		0	1350000	50000	15000	1415000	\N	confirmed	\N	\N	\N	pending	2025-11-20 10:31:25.679978	2025-11-20 12:29:27.350596	pending
bcc3baa1-65cd-4be1-b368-0196726100a1	ORDER-1763639919295	27fbb478-a580-46f8-b9cb-1aa566b87cba	open-trip	\N	\N	\N	\N	afiq	ikki0909@gmail.com	085215667197		\N	2025-12-06	\N	\N	2	t	f	f	f	saya alarge bebek	sadsadsa		0	800000	50000	15000	865000	\N	confirmed	\N	7b76d68b-8bd5-4890-8313-ff8de372cf07	\N	pending	2025-11-20 11:58:39.627135	2025-11-20 12:29:36.740787	pending
\.


--
-- Data for Name: guides; Type: TABLE DATA; Schema: public; Owner: cartenz_admin
--

COPY public.guides (id, name, title, experience_years, rating, total_reviews, total_trips, languages, specialties, price_per_day, avatar_url, description, achievements, is_verified, is_available, created_at, updated_at, photo) FROM stdin;
bc6f1e8c-a86b-48f1-9d15-babc78abfa0d	Syahib Irfan	Mountain Guide	1	0.0	0	0	{"Bahasa Indonesia","Bahasa Enrekang"}	{Bawakaraeng,"Lompo Battang",Latimojong}	299999	/uploads/1762234786625-329577578.jpg		\N	t	t	2025-10-30 17:11:35.674285	2025-11-04 05:39:46.682926	/uploads/1761875950465-237528357.png
dcd534f8-26fc-4c4a-8829-0427d31792a5	MUH. RIFKI	Mountain Guide	3	0.0	0	0	{"Bahasa Inggris","Bahasa Indonesia"}	{Bawakaraeng,"Lembah Lohe",Tanralili}	500000	/uploads/1762235021558-677150666.png		\N	t	t	2025-10-30 17:00:01.871805	2025-11-04 05:43:41.648246	\N
7e15174a-ebc5-4968-a233-29e0f06258fc	Ashabul Kahfi	Mountain Guide	1	0.0	0	0	{"Bahasa Indonesia"}	{Bawakaraeng,"Bulu Baria"}	700000	/uploads/1762235046069-349048108.jpg		\N	t	t	2025-10-30 17:08:59.296342	2025-11-04 05:44:06.107259	\N
\.


--
-- Data for Name: mountains; Type: TABLE DATA; Schema: public; Owner: cartenz_admin
--

COPY public.mountains (id, name, location, altitude, difficulty, description, image_url, is_active, created_at, updated_at) FROM stdin;
159063eb-4ade-45b7-a3dc-08215c259766	Gunung Bawakaraeng	Gowa, Sulawesi Selatan	2833	Sulit	Gunung tertinggi kedua di Sulawesi Selatan dengan pemandangan spektakuler	/uploads/1762840448828-951799819.jpg	t	2025-10-30 22:12:09.153849	2025-10-30 22:12:09.153849
3e2dfe3d-6f21-4e23-ba0e-088e4c27580e	Gunung Bulu Baria	Gowa, Sulawesi Selatan	2200	Menengah	Jalur menantang dengan pemandangan indah	/uploads/1762840487727-337437144.jpg	t	2025-10-30 22:12:09.153849	2025-10-30 22:12:09.153849
2f3b03a6-87f2-4ee3-ab3a-48b266c70cb6	Lembah Lohe	Gowa	1889	Menengah	qwertyy	/uploads/1761863245535-724254143.jpg	t	2025-10-30 22:27:25.544842	2025-10-30 22:27:25.544842
\.


--
-- Data for Name: open_trip_schedules; Type: TABLE DATA; Schema: public; Owner: cartenz_admin
--

COPY public.open_trip_schedules (id, open_trip_id, start_date, end_date, current_participants, status, created_at, updated_at) FROM stdin;
22210126-581b-44ac-b567-07dd9220e33c	\N	2024-12-22	2024-12-25	0	available	2025-10-30 22:12:09.202549	2025-10-30 22:12:09.202549
f50ecccf-b3eb-4ab5-a21b-843c2417036c	\N	2024-12-27	2024-12-31	0	available	2025-10-30 22:12:09.202549	2025-10-30 22:12:09.202549
65b4fcba-7173-465b-b8ab-02c283e8d42e	\N	2025-01-05	2025-01-09	0	available	2025-10-30 22:12:09.202549	2025-10-30 22:12:09.202549
d4363aa7-5abc-4c31-affd-d78de8f50a77	\N	2024-12-29	2024-12-31	0	available	2025-10-30 22:12:09.202549	2025-10-30 22:12:09.202549
a6716ad4-1ffa-4441-9f04-5f2321a4797a	\N	2025-01-05	2025-01-07	0	available	2025-10-30 22:12:09.202549	2025-10-30 22:12:09.202549
f9ca963f-8266-486b-abe3-24cdf445f33e	\N	2024-12-21	2024-12-22	0	available	2025-10-30 22:12:09.202549	2025-10-30 22:12:09.202549
4bb6a187-7900-4086-92b9-3f6371cbde43	\N	2024-12-28	2024-12-29	0	available	2025-10-30 22:12:09.202549	2025-10-30 22:12:09.202549
4ad358f1-2146-4a35-a314-b955801e4285	\N	2025-01-04	2025-01-05	0	available	2025-10-30 22:12:09.202549	2025-10-30 22:12:09.202549
c25ace60-8f85-4ef8-b0ff-0cfbdd42b3c4	\N	2024-12-21	2024-12-22	0	available	2025-10-30 22:12:09.202549	2025-10-30 22:12:09.202549
090d07fe-e6eb-4d2d-902f-c4dfdb50e69c	\N	2024-12-28	2024-12-29	0	available	2025-10-30 22:12:09.202549	2025-10-30 22:12:09.202549
9dc4c0b6-974b-41ec-bd9d-00b456362071	\N	2025-01-04	2025-01-05	0	available	2025-10-30 22:12:09.202549	2025-10-30 22:12:09.202549
c4dabb82-c137-4b9f-a690-bcffaef4fa0b	\N	2024-12-22	2024-12-25	0	available	2025-10-30 22:16:41.45943	2025-10-30 22:16:41.45943
e55d6b06-8389-4747-a78d-9ac28be5048d	\N	2024-12-27	2024-12-31	0	available	2025-10-30 22:16:41.45943	2025-10-30 22:16:41.45943
deaec39a-3498-42bb-a8ba-adf4f55a29e1	\N	2025-01-05	2025-01-09	0	available	2025-10-30 22:16:41.45943	2025-10-30 22:16:41.45943
d904a645-b2b9-4d97-812d-085b367459a5	\N	2024-12-29	2024-12-31	0	available	2025-10-30 22:16:41.45943	2025-10-30 22:16:41.45943
c3ac033c-482c-4b30-8997-807585a88867	\N	2025-01-05	2025-01-07	0	available	2025-10-30 22:16:41.45943	2025-10-30 22:16:41.45943
393107d6-1c7a-48b9-b0c6-497cda783eb1	\N	2024-12-21	2024-12-22	0	available	2025-10-30 22:16:41.45943	2025-10-30 22:16:41.45943
219dc9ee-5b20-413e-9e93-3acd8b8e800a	\N	2024-12-28	2024-12-29	0	available	2025-10-30 22:16:41.45943	2025-10-30 22:16:41.45943
5398cd3d-94f9-44e7-917b-fafea6801588	\N	2025-01-04	2025-01-05	0	available	2025-10-30 22:16:41.45943	2025-10-30 22:16:41.45943
f4f9ed4b-5fb2-470d-bc5a-271be872511c	\N	2024-12-21	2024-12-22	0	available	2025-10-30 22:16:41.45943	2025-10-30 22:16:41.45943
ec19c76e-9fb6-4be8-907b-ad3491cb4993	\N	2024-12-28	2024-12-29	0	available	2025-10-30 22:16:41.45943	2025-10-30 22:16:41.45943
69c883a0-4bfb-4d0f-96a3-f30549f36db7	\N	2025-01-04	2025-01-05	0	available	2025-10-30 22:16:41.45943	2025-10-30 22:16:41.45943
\.


--
-- Data for Name: open_trips; Type: TABLE DATA; Schema: public; Owner: cartenz_admin
--

COPY public.open_trips (id, title, mountain_id, duration_days, duration_nights, difficulty, base_price, original_price, min_participants, max_participants, description, image_url, includes, highlights, itinerary, rating, total_reviews, is_active, created_at, updated_at, quota_remaining, is_closed) FROM stdin;
a3dcb790-7369-43e2-bd39-40ba9ed96385	Bawakaraeng	159063eb-4ade-45b7-a3dc-08215c259766	4	3	Sulit	500000	749998	5	9	asdasdasdada	/uploads/1761870299891-128892115.jpg	{dasdasdasda,asdasdasd}	{asdasdasda,asdasda}	\N	0.0	0	t	2025-10-31 00:24:59.967929	2025-10-31 00:24:59.967929	9	f
78018df2-4f8f-4544-94ff-24869b7e788e	Bulu Baria	3e2dfe3d-6f21-4e23-ba0e-088e4c27580e	3	2	Menengah	300000	599999	5	10	Siap menemani perjalanan anda dengan nyaman\r\n	/uploads/1761872368048-2483501.jpg	{P3k,"Makanan Berat"}	{}	\N	0.0	0	t	2025-10-31 00:59:28.057757	2025-10-31 00:59:28.057757	10	f
e479cc81-1b60-410d-a506-467fcc8bb13b	Lembah Lohe	\N	2	1	Ringan	200000	470000	5	10	Siap menemani perjalanan anda dengan nyaman	/uploads/1761871835473-540138404.jpg	{"[\\"[\\\\\\"[\\\\\\\\\\\\\\"Makanan Berat\\\\\\\\\\\\\\"]\\\\\\"]\\"]"}	{"[\\"[\\\\\\"[]\\\\\\"]\\"]"}	\N	0.0	0	t	2025-10-31 00:50:35.50605	2025-10-31 00:50:35.50605	10	f
\.


--
-- Data for Name: payments; Type: TABLE DATA; Schema: public; Owner: cartenz_admin
--

COPY public.payments (id, booking_id, external_id, invoice_url, amount, payment_method, payment_channel, status, paid_at, expired_at, metadata, created_at, updated_at) FROM stdin;
646cddaa-9ab3-4f0d-bb4a-2463fdcb9905	bcc3baa1-65cd-4be1-b368-0196726100a1	32738b45-b90e-4282-9593-78788be713b6	\N	865000	bank_transfer	\N	settlement	\N	\N	{"pdf_url": "https://app.sandbox.midtrans.com/snap/v1/transactions/7b76d68b-8bd5-4890-8313-ff8de372cf07/pdf", "order_id": "ORDER-1763639919295", "va_numbers": [{"bank": "bri", "va_number": "350965625981205435"}], "status_code": "200", "fraud_status": "accept", "gross_amount": "865000.00", "payment_type": "bank_transfer", "status_message": "Success, transaction is found", "transaction_id": "32738b45-b90e-4282-9593-78788be713b6", "transaction_time": "2025-11-20 18:58:49", "transaction_status": "settlement", "finish_redirect_url": "http://example.com?order_id=ORDER-1763639919295&status_code=200&transaction_status=settlement"}	2025-11-20 11:59:12.405351	2025-11-20 11:59:12.405351
\.


--
-- Data for Name: porters; Type: TABLE DATA; Schema: public; Owner: cartenz_admin
--

COPY public.porters (id, name, experience_years, rating, total_reviews, total_trips, max_capacity_kg, specialties, price_per_day, avatar_url, description, achievements, is_available, created_at, updated_at, photo) FROM stdin;
9e38dbc6-a44c-4340-8482-37fe7dd818ae	Ifan Triyandies	1	0.0	0	0	17	{Bawakaraeng,"Lembah Lohe"}	200000	/uploads/1762235076273-403467843.jpg	Berpengalaman siap membantu & menemani perjalanan anda dengan nyaman	\N	t	2025-10-30 17:14:48.09635	2025-11-04 05:44:36.314749	\N
8f497365-620d-4f2e-bcd1-244c0311e75b	Afiq Putra Faisal	1	0.0	0	0	20	{Bawakaraeng,"Lompo Battang"}	399999	/uploads/1762235299850-499050413.jpg	Berpengalaman siap membantu & menemani perjalanan anda dengan nyaman	\N	t	2025-10-30 17:16:55.904167	2025-11-04 05:48:19.917295	\N
376eef2c-3807-4a63-bd41-d0e4be2348eb	Nur Agung 	1	0.0	0	0	15	{"Lembah Lohe","Bulu Baria"}	299999	/uploads/1762235334604-437685766.jpg	Berpengalaman siap membantu & menemani perjalanan anda dengan nyaman	\N	t	2025-10-30 17:18:58.141221	2025-11-04 05:48:54.652869	\N
\.


--
-- Data for Name: reviews; Type: TABLE DATA; Schema: public; Owner: cartenz_admin
--

COPY public.reviews (id, booking_id, user_id, guide_id, porter_id, open_trip_id, rating, title, comment, images, is_verified, is_published, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: cartenz_admin
--

COPY public.users (id, full_name, email, phone, password_hash, avatar_url, role, is_verified, created_at, updated_at) FROM stdin;
27fbb478-a580-46f8-b9cb-1aa566b87cba	ikki	ikki0102@gmail.com	085215667197	$2b$10$jRk.L5GWKEp6Mw12oUe7Su/Xxa1nZGvNhb0M4JTTVHXY47DYQ5QaO	\N	user	f	2025-11-04 06:07:28.410747	2025-11-04 06:07:28.410747
97635b4e-83df-4d8e-bb0d-3387156d6ca0	admin	admin@cartenz.com	0987654325432	$2b$10$JnTs2/bbm4XllLBY7gDqo.f9ciFo2Z1u6pRF/v.3v9s/k9qbpsgSi	\N	admin	f	2025-11-04 06:16:51.654148	2025-11-04 06:47:04.019323
289c47cb-ffce-4c9d-886a-4f13bf0cc561	katak	taktak01@gmail.com	08765434567	$2b$10$ZDidRoO.RuJJ9Zm5EfrQ1ucNpCc2hpzn/j.MI8uRJ4rTJeqn3DVdO	\N	user	f	2025-11-04 07:17:53.997319	2025-11-04 07:17:53.997319
07cd946c-bfb1-4bc7-98a0-1fb80f0d8e3c	testuser	test@user.com	1234567890	$2b$10$wqUpecVgdH2sCWw64hMbyu3rYPhWtIAbk1M1hy2uHklirLYuOUsVS	\N	user	f	2025-11-04 07:42:29.128974	2025-11-04 07:42:29.128974
e6125591-7c5a-432e-ba35-6c3c9ec8d0c1	newadmin	new@admin.com		$2b$10$A.OIEXtjMvyOBkheYQqFEOd.PtImhfF8zVvFkWbpERfCqTnyIi6.O	\N	admin	f	2025-11-04 07:42:52.080902	2025-11-04 07:42:52.080902
\.


--
-- Name: bookings bookings_booking_code_key; Type: CONSTRAINT; Schema: public; Owner: cartenz_admin
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_booking_code_key UNIQUE (booking_code);


--
-- Name: bookings bookings_pkey; Type: CONSTRAINT; Schema: public; Owner: cartenz_admin
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_pkey PRIMARY KEY (id);


--
-- Name: guides guides_pkey; Type: CONSTRAINT; Schema: public; Owner: cartenz_admin
--

ALTER TABLE ONLY public.guides
    ADD CONSTRAINT guides_pkey PRIMARY KEY (id);


--
-- Name: mountains mountains_pkey; Type: CONSTRAINT; Schema: public; Owner: cartenz_admin
--

ALTER TABLE ONLY public.mountains
    ADD CONSTRAINT mountains_pkey PRIMARY KEY (id);


--
-- Name: open_trip_schedules open_trip_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: cartenz_admin
--

ALTER TABLE ONLY public.open_trip_schedules
    ADD CONSTRAINT open_trip_schedules_pkey PRIMARY KEY (id);


--
-- Name: open_trips open_trips_pkey; Type: CONSTRAINT; Schema: public; Owner: cartenz_admin
--

ALTER TABLE ONLY public.open_trips
    ADD CONSTRAINT open_trips_pkey PRIMARY KEY (id);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: cartenz_admin
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: porters porters_pkey; Type: CONSTRAINT; Schema: public; Owner: cartenz_admin
--

ALTER TABLE ONLY public.porters
    ADD CONSTRAINT porters_pkey PRIMARY KEY (id);


--
-- Name: reviews reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: cartenz_admin
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: cartenz_admin
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: cartenz_admin
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: idx_bookings_date; Type: INDEX; Schema: public; Owner: cartenz_admin
--

CREATE INDEX idx_bookings_date ON public.bookings USING btree (start_date);


--
-- Name: idx_bookings_payment_status; Type: INDEX; Schema: public; Owner: cartenz_admin
--

CREATE INDEX idx_bookings_payment_status ON public.bookings USING btree (payment_status);


--
-- Name: idx_bookings_status; Type: INDEX; Schema: public; Owner: cartenz_admin
--

CREATE INDEX idx_bookings_status ON public.bookings USING btree (status);


--
-- Name: idx_bookings_user; Type: INDEX; Schema: public; Owner: cartenz_admin
--

CREATE INDEX idx_bookings_user ON public.bookings USING btree (user_id);


--
-- Name: idx_open_trips_mountain; Type: INDEX; Schema: public; Owner: cartenz_admin
--

CREATE INDEX idx_open_trips_mountain ON public.open_trips USING btree (mountain_id);


--
-- Name: idx_payments_booking; Type: INDEX; Schema: public; Owner: cartenz_admin
--

CREATE INDEX idx_payments_booking ON public.payments USING btree (booking_id);


--
-- Name: idx_reviews_booking; Type: INDEX; Schema: public; Owner: cartenz_admin
--

CREATE INDEX idx_reviews_booking ON public.reviews USING btree (booking_id);


--
-- Name: bookings update_bookings_updated_at; Type: TRIGGER; Schema: public; Owner: cartenz_admin
--

CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: guides update_guides_updated_at; Type: TRIGGER; Schema: public; Owner: cartenz_admin
--

CREATE TRIGGER update_guides_updated_at BEFORE UPDATE ON public.guides FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: porters update_porters_updated_at; Type: TRIGGER; Schema: public; Owner: cartenz_admin
--

CREATE TRIGGER update_porters_updated_at BEFORE UPDATE ON public.porters FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: users update_users_updated_at; Type: TRIGGER; Schema: public; Owner: cartenz_admin
--

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: bookings bookings_guide_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: cartenz_admin
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_guide_id_fkey FOREIGN KEY (guide_id) REFERENCES public.guides(id);


--
-- Name: bookings bookings_mountain_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: cartenz_admin
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_mountain_id_fkey FOREIGN KEY (mountain_id) REFERENCES public.mountains(id);


--
-- Name: bookings bookings_open_trip_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: cartenz_admin
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_open_trip_id_fkey FOREIGN KEY (open_trip_id) REFERENCES public.open_trips(id);


--
-- Name: bookings bookings_porter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: cartenz_admin
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_porter_id_fkey FOREIGN KEY (porter_id) REFERENCES public.porters(id);


--
-- Name: bookings bookings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: cartenz_admin
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: open_trip_schedules open_trip_schedules_open_trip_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: cartenz_admin
--

ALTER TABLE ONLY public.open_trip_schedules
    ADD CONSTRAINT open_trip_schedules_open_trip_id_fkey FOREIGN KEY (open_trip_id) REFERENCES public.open_trips(id) ON DELETE CASCADE;


--
-- Name: open_trips open_trips_mountain_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: cartenz_admin
--

ALTER TABLE ONLY public.open_trips
    ADD CONSTRAINT open_trips_mountain_id_fkey FOREIGN KEY (mountain_id) REFERENCES public.mountains(id);


--
-- Name: payments payments_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: cartenz_admin
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id);


--
-- Name: reviews reviews_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: cartenz_admin
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id);


--
-- Name: reviews reviews_guide_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: cartenz_admin
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_guide_id_fkey FOREIGN KEY (guide_id) REFERENCES public.guides(id);


--
-- Name: reviews reviews_open_trip_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: cartenz_admin
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_open_trip_id_fkey FOREIGN KEY (open_trip_id) REFERENCES public.open_trips(id);


--
-- Name: reviews reviews_porter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: cartenz_admin
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_porter_id_fkey FOREIGN KEY (porter_id) REFERENCES public.porters(id);


--
-- Name: reviews reviews_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: cartenz_admin
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- PostgreSQL database dump complete
--

\unrestrict P91qzxgbm17K7mJu2v56dsP7OCqZzgOj48a7jgzZwnZoru55qjVSVPUJlakpfRx

