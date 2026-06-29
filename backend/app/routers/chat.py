from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from ..db import get_session
from ..models import ChatMessage
from ..services import gemini, summaries

router = APIRouter(prefix="/chat", tags=["chat"])


class ChatRequest(BaseModel):
    conversation_id: str = "default"
    content: str


@router.get("/messages", response_model=list[ChatMessage])
def get_messages(conversation_id: str = "default", session: Session = Depends(get_session)):
    return session.exec(
        select(ChatMessage)
        .where(ChatMessage.conversation_id == conversation_id)
        .order_by(ChatMessage.date, ChatMessage.id)
    ).all()


@router.delete("/messages", status_code=204)
def clear_messages(conversation_id: str = "default", session: Session = Depends(get_session)):
    for m in session.exec(
        select(ChatMessage).where(ChatMessage.conversation_id == conversation_id)
    ).all():
        session.delete(m)
    session.commit()


@router.post("", response_model=ChatMessage)
def send_message(req: ChatRequest, session: Session = Depends(get_session)):
    # Persist the user's message.
    user_msg = ChatMessage(conversation_id=req.conversation_id, role="user", content=req.content)
    session.add(user_msg)
    session.commit()

    history = session.exec(
        select(ChatMessage)
        .where(ChatMessage.conversation_id == req.conversation_id)
        .order_by(ChatMessage.date, ChatMessage.id)
    ).all()
    data_summary = summaries.build_data_summary(session)

    try:
        reply = gemini.chat(
            [{"role": m.role, "content": m.content} for m in history if m.role in ("user", "assistant")],
            data_summary=data_summary,
        )
    except gemini.GeminiNotConfigured as e:
        raise HTTPException(400, str(e)) from e
    except Exception as e:
        raise HTTPException(502, f"Erreur Gemini : {e}") from e

    assistant_msg = ChatMessage(conversation_id=req.conversation_id, role="assistant", content=reply)
    session.add(assistant_msg)
    session.commit()
    session.refresh(assistant_msg)
    return assistant_msg
