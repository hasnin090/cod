#!/bin/bash

# ترحيل قاعدة البيانات
function push_db() {
  echo "ترحيل المخطط إلى قاعدة البيانات..."
  npx drizzle-kit push --config=./server/drizzle.config.ts
}

# عرض الجداول الموجودة
function show_tables() {
  echo "عرض الجداول الموجودة في قاعدة البيانات..."
  echo "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';" | psql $DATABASE_URL
}

# حسب الأمر المطلوب
case "$1" in
  push)
    push_db
    ;;
  tables)
    show_tables
    ;;
  *)
    echo "الاستخدام: $0 {push|tables}"
    exit 1
    ;;
esac

exit 0