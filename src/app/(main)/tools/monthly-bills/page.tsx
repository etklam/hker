import { redirect } from 'next/navigation'

export default function MonthlyBillsRedirectPage(): never {
  redirect('/bills')
}
