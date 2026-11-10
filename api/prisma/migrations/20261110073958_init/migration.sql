-- CreateTable
CREATE TABLE "m_grant_rule" (
    "rule_id" SERIAL NOT NULL,
    "record_type" VARCHAR(20) NOT NULL,
    "points" INTEGER NOT NULL,
    "max_points" INTEGER NOT NULL,
    "annual_limit" INTEGER,
    "valid_months" INTEGER NOT NULL DEFAULT 12,
    "notice_days" INTEGER NOT NULL DEFAULT 30,
    "valid_from" DATE NOT NULL,
    "valid_to" DATE,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "m_grant_rule_pkey" PRIMARY KEY ("rule_id")
);

-- CreateTable
CREATE TABLE "m_school_district" (
    "district_code" VARCHAR(10) NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "m_school_district_pkey" PRIMARY KEY ("district_code")
);

-- CreateTable
CREATE TABLE "m_venue" (
    "venue_id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "address" VARCHAR(200) NOT NULL,
    "district_code" VARCHAR(10),

    CONSTRAINT "m_venue_pkey" PRIMARY KEY ("venue_id")
);

-- CreateTable
CREATE TABLE "m_exercise_preset" (
    "preset_id" SERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "unit" VARCHAR(10) NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "m_exercise_preset_pkey" PRIMARY KEY ("preset_id")
);

-- CreateTable
CREATE TABLE "t_account" (
    "account_id" SERIAL NOT NULL,
    "login_id" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "account_type" VARCHAR(20) NOT NULL,
    "event_id" INTEGER,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ(3),
    "reset_token_hash" VARCHAR(64),
    "reset_expires_at" TIMESTAMPTZ(3),
    "status" VARCHAR(10) NOT NULL DEFAULT '有効',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "t_account_pkey" PRIMARY KEY ("account_id")
);

-- CreateTable
CREATE TABLE "t_session" (
    "session_id" VARCHAR(64) NOT NULL,
    "account_id" INTEGER NOT NULL,
    "client" VARCHAR(10) NOT NULL DEFAULT 'web',
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "t_session_pkey" PRIMARY KEY ("session_id")
);

-- CreateTable
CREATE TABLE "t_refresh_token" (
    "refresh_token_id" SERIAL NOT NULL,
    "account_id" INTEGER NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "family_id" VARCHAR(36) NOT NULL,
    "session_id" VARCHAR(64),
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "t_refresh_token_pkey" PRIMARY KEY ("refresh_token_id")
);

-- CreateTable
CREATE TABLE "t_user" (
    "user_id" SERIAL NOT NULL,
    "account_id" INTEGER NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "birth_date" DATE NOT NULL,
    "district_code" VARCHAR(10) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "status" VARCHAR(10) NOT NULL DEFAULT '有効',
    "withdrawn_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "t_user_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "t_display_setting" (
    "user_id" INTEGER NOT NULL,
    "font_scale" VARCHAR(10) NOT NULL DEFAULT 'normal',
    "notify_enabled" BOOLEAN NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "t_display_setting_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "t_staff" (
    "staff_id" SERIAL NOT NULL,
    "account_id" INTEGER NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "staff_type" VARCHAR(10) NOT NULL,
    "organization" VARCHAR(100),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "t_staff_pkey" PRIMARY KEY ("staff_id")
);

-- CreateTable
CREATE TABLE "t_qr_token" (
    "token" VARCHAR(64) NOT NULL,
    "user_id" INTEGER NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "used_at" TIMESTAMPTZ(3),
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "t_qr_token_pkey" PRIMARY KEY ("token")
);

-- CreateTable
CREATE TABLE "t_device_token" (
    "device_token_id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "token" VARCHAR(512) NOT NULL,
    "platform" VARCHAR(10) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "registered_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMPTZ(3),

    CONSTRAINT "t_device_token_pkey" PRIMARY KEY ("device_token_id")
);

-- CreateTable
CREATE TABLE "t_event" (
    "event_id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "start_at" TIMESTAMPTZ(3) NOT NULL,
    "end_at" TIMESTAMPTZ(3) NOT NULL,
    "venue_id" INTEGER NOT NULL,
    "capacity" INTEGER,
    "grant_points" INTEGER NOT NULL,
    "status" VARCHAR(10) NOT NULL DEFAULT '下書き',
    "event_qr" VARCHAR(64),
    "created_by" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "t_event_pkey" PRIMARY KEY ("event_id")
);

-- CreateTable
CREATE TABLE "t_attendance" (
    "attendance_id" SERIAL NOT NULL,
    "event_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "attended_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "terminal_account_id" INTEGER NOT NULL,
    "granted" BOOLEAN NOT NULL DEFAULT false,
    "granted_at" TIMESTAMPTZ(3),

    CONSTRAINT "t_attendance_pkey" PRIMARY KEY ("attendance_id")
);

-- CreateTable
CREATE TABLE "t_step_record" (
    "step_record_id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "record_date" DATE NOT NULL,
    "steps" INTEGER NOT NULL,
    "source" VARCHAR(20) NOT NULL,
    "granted_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "t_step_record_pkey" PRIMARY KEY ("step_record_id")
);

-- CreateTable
CREATE TABLE "t_step_record_log" (
    "step_record_log_id" SERIAL NOT NULL,
    "step_record_id" INTEGER NOT NULL,
    "previous_steps" INTEGER,
    "new_steps" INTEGER NOT NULL,
    "source" VARCHAR(20) NOT NULL,
    "changed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "t_step_record_log_pkey" PRIMARY KEY ("step_record_log_id")
);

-- CreateTable
CREATE TABLE "t_exercise" (
    "exercise_id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "unit" VARCHAR(10) NOT NULL,
    "preset_id" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "t_exercise_pkey" PRIMARY KEY ("exercise_id")
);

-- CreateTable
CREATE TABLE "t_exercise_log" (
    "exercise_log_id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "exercise_id" INTEGER NOT NULL,
    "record_date" DATE NOT NULL,
    "amount" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "t_exercise_log_pkey" PRIMARY KEY ("exercise_log_id")
);

-- CreateTable
CREATE TABLE "t_step_goal" (
    "step_goal_id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "weekly_steps" INTEGER NOT NULL,
    "effective_from" DATE NOT NULL,

    CONSTRAINT "t_step_goal_pkey" PRIMARY KEY ("step_goal_id")
);

-- CreateTable
CREATE TABLE "t_exercise_goal" (
    "exercise_goal_id" SERIAL NOT NULL,
    "exercise_id" INTEGER NOT NULL,
    "period" VARCHAR(10) NOT NULL,
    "target_amount" INTEGER NOT NULL,
    "effective_from" DATE NOT NULL,

    CONSTRAINT "t_exercise_goal_pkey" PRIMARY KEY ("exercise_goal_id")
);

-- CreateTable
CREATE TABLE "t_meal_log" (
    "meal_log_id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "record_date" DATE NOT NULL,
    "meal_type" VARCHAR(10) NOT NULL,
    "image_key" VARCHAR(200) NOT NULL,
    "memo" VARCHAR(100),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "t_meal_log_pkey" PRIMARY KEY ("meal_log_id")
);

-- CreateTable
CREATE TABLE "t_point_ledger" (
    "ledger_id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "kind" VARCHAR(10) NOT NULL,
    "points" INTEGER NOT NULL,
    "remaining" INTEGER,
    "source_type" VARCHAR(10) NOT NULL,
    "source_id" INTEGER,
    "grant_ledger_id" INTEGER,
    "recorded_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" DATE,

    CONSTRAINT "t_point_ledger_pkey" PRIMARY KEY ("ledger_id")
);

-- CreateTable
CREATE TABLE "t_shop" (
    "shop_id" SERIAL NOT NULL,
    "account_id" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "address" VARCHAR(200) NOT NULL,
    "business_type" VARCHAR(30) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "settlement_type" VARCHAR(20),
    "status" VARCHAR(10) NOT NULL DEFAULT '有効',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "t_shop_pkey" PRIMARY KEY ("shop_id")
);

-- CreateTable
CREATE TABLE "t_redeem" (
    "redeem_id" SERIAL NOT NULL,
    "shop_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,
    "redeemed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settlement_id" INTEGER,
    "settled" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "t_redeem_pkey" PRIMARY KEY ("redeem_id")
);

-- CreateTable
CREATE TABLE "t_settlement" (
    "settlement_id" SERIAL NOT NULL,
    "shop_id" INTEGER NOT NULL,
    "target_month" VARCHAR(7) NOT NULL,
    "redeem_count" INTEGER NOT NULL DEFAULT 0,
    "total_points" INTEGER NOT NULL DEFAULT 0,
    "rate" DECIMAL(10,2) NOT NULL,
    "amount" INTEGER NOT NULL DEFAULT 0,
    "status" VARCHAR(10) NOT NULL DEFAULT '締め済み',
    "closed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paid_at" TIMESTAMPTZ(3),
    "paid_by" INTEGER,

    CONSTRAINT "t_settlement_pkey" PRIMARY KEY ("settlement_id")
);

-- CreateTable
CREATE TABLE "t_log" (
    "log_id" SERIAL NOT NULL,
    "module" VARCHAR(30) NOT NULL,
    "log_type" VARCHAR(10) NOT NULL,
    "account_id" INTEGER,
    "result_code" VARCHAR(11) NOT NULL,
    "message" VARCHAR(500),
    "logged_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "t_log_pkey" PRIMARY KEY ("log_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "t_account_login_id_key" ON "t_account"("login_id");

-- CreateIndex
CREATE UNIQUE INDEX "t_refresh_token_token_hash_key" ON "t_refresh_token"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "t_user_account_id_key" ON "t_user"("account_id");

-- CreateIndex
CREATE UNIQUE INDEX "t_user_email_key" ON "t_user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "t_staff_account_id_key" ON "t_staff"("account_id");

-- CreateIndex
CREATE UNIQUE INDEX "t_device_token_token_key" ON "t_device_token"("token");

-- CreateIndex
CREATE UNIQUE INDEX "t_attendance_event_id_user_id_key" ON "t_attendance"("event_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "t_step_record_user_id_record_date_key" ON "t_step_record"("user_id", "record_date");

-- CreateIndex
CREATE UNIQUE INDEX "t_exercise_log_exercise_id_record_date_key" ON "t_exercise_log"("exercise_id", "record_date");

-- CreateIndex
CREATE UNIQUE INDEX "t_step_goal_user_id_effective_from_key" ON "t_step_goal"("user_id", "effective_from");

-- CreateIndex
CREATE UNIQUE INDEX "t_exercise_goal_exercise_id_effective_from_key" ON "t_exercise_goal"("exercise_id", "effective_from");

-- CreateIndex
CREATE INDEX "t_meal_log_user_id_record_date_idx" ON "t_meal_log"("user_id", "record_date");

-- CreateIndex
CREATE UNIQUE INDEX "t_shop_account_id_key" ON "t_shop"("account_id");

-- CreateIndex
CREATE UNIQUE INDEX "t_shop_name_address_key" ON "t_shop"("name", "address");

-- CreateIndex
CREATE UNIQUE INDEX "t_settlement_shop_id_target_month_key" ON "t_settlement"("shop_id", "target_month");

-- AddForeignKey
ALTER TABLE "m_venue" ADD CONSTRAINT "m_venue_district_code_fkey" FOREIGN KEY ("district_code") REFERENCES "m_school_district"("district_code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "t_account" ADD CONSTRAINT "t_account_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "t_event"("event_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "t_session" ADD CONSTRAINT "t_session_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "t_account"("account_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "t_refresh_token" ADD CONSTRAINT "t_refresh_token_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "t_account"("account_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "t_user" ADD CONSTRAINT "t_user_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "t_account"("account_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "t_user" ADD CONSTRAINT "t_user_district_code_fkey" FOREIGN KEY ("district_code") REFERENCES "m_school_district"("district_code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "t_display_setting" ADD CONSTRAINT "t_display_setting_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "t_user"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "t_staff" ADD CONSTRAINT "t_staff_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "t_account"("account_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "t_qr_token" ADD CONSTRAINT "t_qr_token_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "t_user"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "t_device_token" ADD CONSTRAINT "t_device_token_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "t_user"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "t_event" ADD CONSTRAINT "t_event_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "m_venue"("venue_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "t_event" ADD CONSTRAINT "t_event_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "t_staff"("staff_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "t_attendance" ADD CONSTRAINT "t_attendance_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "t_event"("event_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "t_attendance" ADD CONSTRAINT "t_attendance_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "t_user"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "t_attendance" ADD CONSTRAINT "t_attendance_terminal_account_id_fkey" FOREIGN KEY ("terminal_account_id") REFERENCES "t_account"("account_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "t_step_record" ADD CONSTRAINT "t_step_record_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "t_user"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "t_step_record_log" ADD CONSTRAINT "t_step_record_log_step_record_id_fkey" FOREIGN KEY ("step_record_id") REFERENCES "t_step_record"("step_record_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "t_exercise" ADD CONSTRAINT "t_exercise_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "t_user"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "t_exercise" ADD CONSTRAINT "t_exercise_preset_id_fkey" FOREIGN KEY ("preset_id") REFERENCES "m_exercise_preset"("preset_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "t_exercise_log" ADD CONSTRAINT "t_exercise_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "t_user"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "t_exercise_log" ADD CONSTRAINT "t_exercise_log_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "t_exercise"("exercise_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "t_step_goal" ADD CONSTRAINT "t_step_goal_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "t_user"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "t_exercise_goal" ADD CONSTRAINT "t_exercise_goal_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "t_exercise"("exercise_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "t_meal_log" ADD CONSTRAINT "t_meal_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "t_user"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "t_point_ledger" ADD CONSTRAINT "t_point_ledger_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "t_user"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "t_point_ledger" ADD CONSTRAINT "t_point_ledger_grant_ledger_id_fkey" FOREIGN KEY ("grant_ledger_id") REFERENCES "t_point_ledger"("ledger_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "t_shop" ADD CONSTRAINT "t_shop_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "t_account"("account_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "t_redeem" ADD CONSTRAINT "t_redeem_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "t_shop"("shop_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "t_redeem" ADD CONSTRAINT "t_redeem_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "t_user"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "t_redeem" ADD CONSTRAINT "t_redeem_settlement_id_fkey" FOREIGN KEY ("settlement_id") REFERENCES "t_settlement"("settlement_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "t_settlement" ADD CONSTRAINT "t_settlement_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "t_shop"("shop_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "t_settlement" ADD CONSTRAINT "t_settlement_paid_by_fkey" FOREIGN KEY ("paid_by") REFERENCES "t_staff"("staff_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "t_log" ADD CONSTRAINT "t_log_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "t_account"("account_id") ON DELETE SET NULL ON UPDATE CASCADE;
