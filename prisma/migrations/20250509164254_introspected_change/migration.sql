-- CreateTable
CREATE TABLE "conversation" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "admin_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_message_id" INTEGER,

    CONSTRAINT "conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message" (
    "id" SERIAL NOT NULL,
    "conversation_id" INTEGER NOT NULL,
    "sender_id" INTEGER NOT NULL,
    "message_text" TEXT NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_read" BOOLEAN DEFAULT false,
    "message_id" SERIAL NOT NULL,

    CONSTRAINT "message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "unique_user_admin" ON "conversation"("user_id", "admin_id");

-- CreateIndex
CREATE UNIQUE INDEX "message_message_id_key" ON "message"("message_id");

-- AddForeignKey
ALTER TABLE "conversation" ADD CONSTRAINT "fk_admin" FOREIGN KEY ("admin_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "conversation" ADD CONSTRAINT "fk_last_message" FOREIGN KEY ("last_message_id") REFERENCES "message"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "conversation" ADD CONSTRAINT "fk_user" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "message" ADD CONSTRAINT "fk_conversation" FOREIGN KEY ("conversation_id") REFERENCES "conversation"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "message" ADD CONSTRAINT "fk_sender" FOREIGN KEY ("sender_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
