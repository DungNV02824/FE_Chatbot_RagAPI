const MessageBubble = ({ message }) => {
  return (
    <div className={`bubble ${message.role}`}>
      {message.content}
    </div>
  );
};

export default MessageBubble;