select u.name, a.task_id, a.content, a.answered_on   
from answer as a, userAnswer as ua, user as u 
where a.task_id like "113073%" and ua.answer_id = a.id and u.id = ua.user_id 
order by ua.user_id;

