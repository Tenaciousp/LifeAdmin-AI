"""Energy renewal planning helpers."""

from __future__ import annotations

from typing import Any


def renewal_sections(task: dict[str, Any]) -> dict[str, str]:
    details = task.get("details") if isinstance(task.get("details"), dict) else {}
    provider = str(details.get("provider") or "the supplier").strip()
    account_reference = str(details.get("account_reference") or "").strip()
    utility_type = str(details.get("utility_type") or "not supplied").strip()
    annual_usage = str(details.get("annual_usage") or "not supplied").strip()
    tariff = str(details.get("tariff") or "not supplied").strip()
    unit_rate = str(details.get("unit_rate") or "not supplied").strip()
    standing_charge = str(details.get("standing_charge") or "not supplied").strip()
    current_price = str(details.get("current_price") or details.get("amount") or "not supplied").strip()
    current_price_frequency = str(details.get("current_price_frequency") or "not supplied").strip()
    renewal_quote = str(details.get("new_quote") or "not supplied").strip()
    renewal_quote_frequency = str(details.get("renewal_quote_frequency") or "not supplied").strip()
    renewal_date = str(details.get("renewal_date") or details.get("date") or "not supplied").strip()
    exit_fee = str(details.get("exit_fee") or "not supplied").strip()
    renewal_priority = str(details.get("renewal_priority") or "not supplied").strip()
    switch_willingness = str(details.get("switch_willingness") or "not supplied").strip()

    return {
        "next_steps": (
            f"1. Confirm {provider}'s renewal date, price frequency and tariff terms.\n"
            f"2. Rank options against the stated renewal priority: {renewal_priority}.\n"
            f"3. Apply the switching preference when comparing stay, retention and switch options: {switch_willingness}.\n"
            f"4. Use the supplied annual usage for each like-for-like comparison: {annual_usage}.\n"
            "5. Convert current and renewal prices to the same annual basis using the confirmed price frequencies before comparing them.\n"
            "6. For dual fuel, calculate electricity and gas separately before adding annual costs.\n"
            "7. Compare first-year cost after applicable exit fees with ongoing annual cost.\n"
            "8. Mark the comparison incomplete when usage, rates, standing charges or price frequency are missing or marked Not sure."
        ),
        "provider_message": (
            f"Hello {provider}, I am reviewing my upcoming renewal."
            + (f" My account/customer reference is {account_reference}." if account_reference else "")
            + (f" My main priority is {renewal_priority}." if renewal_priority != "not supplied" else "")
            + (f" My switching preference is {switch_willingness}." if switch_willingness != "not supplied" else "")
            + (
                f" My current price is {current_price}"
                + (f" ({current_price_frequency})." if current_price_frequency != "not supplied" else ".")
                if current_price != "not supplied"
                else ""
            )
            + (
                f" My renewal quote is {renewal_quote}"
                + (f" ({renewal_quote_frequency})." if renewal_quote_frequency != "not supplied" else ".")
                if renewal_quote != "not supplied"
                else ""
            )
            + (f" My renewal date is {renewal_date}." if renewal_date != "not supplied" else "")
            + " Please confirm my current tariff name and type, annual usage, current unit rate(s), standing charge(s), tariff end or renewal date, "
            "renewal tariff and any exit fee in writing. Please also confirm whether the renewal quote is monthly or annual."
        ),
        "things_to_check": (
            f"- Supply type: {utility_type}. Current tariff: {tariff}.\n"
            f"- Unit rates supplied: {unit_rate}. Standing charges supplied: {standing_charge}.\n"
            f"- Current price: {current_price}. Current price frequency: {current_price_frequency}.\n"
            f"- Renewal quote: {renewal_quote}. Renewal quote frequency: {renewal_quote_frequency}.\n"
            f"- Renewal date: {renewal_date}. Exit fees: {exit_fee}.\n"
            f"- Renewal priority: {renewal_priority}. Switching preference: {switch_willingness}.\n"
            "- Electricity or gas annual tariff cost = annual kWh x unit rate + 365 x daily standing charge.\n"
            "- Dual fuel annual cost = electricity annual cost + gas annual cost.\n"
            "- First-year switch cost = alternative annual tariff cost + applicable exit fees.\n"
            "- First-year saving = comparable current or renewal annual cost - first-year switch cost.\n"
            "- Ongoing annual saving = comparable current or renewal annual cost - alternative annual tariff cost."
        ),
        "approval_checklist": (
            "- Electricity and gas figures separated for dual fuel.\n"
            "- Current and renewal price frequency confirmed and converted to the same comparison period.\n"
            "- First-year saving checked after exit fees.\n"
            "- Ongoing annual saving checked without one-off exit fees.\n"
            "- Supplier, dates and tariff terms reviewed before any switch or renewal is approved.\n"
            "- Final choice reflects the stated renewal priority and switching preference."
        ),
    }
